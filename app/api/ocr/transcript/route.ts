import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";
import { matchNccuCourse } from "../../../../lib/nccu-course-match";
import { normalizeTranscriptAcademicYear, resolveOcrTranscriptPeriod, resolveTranscriptYearHeader, transcriptRowsFromYearLine, type TranscriptRow } from "../../../../lib/transcript-review";
import { isTranscriptGradeDash, isTranscriptPageText, transcriptScanRotations } from "../../../../lib/transcript-scan-layout";
import type { TranscriptGridSlot } from "../../../../lib/nccu-transcript-grid";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const transcriptEvidence = "只有圖片實際印有課程列與對應的學分或成績欄位時，才將 transcriptVisible 設為 true。空白圖片、校名、浮水印、表頭、總計或無關的文字都不足以確認有課程。沒有看到課程列，設為 false 並回傳空清單。";
const ocrInstructions = [
  transcriptEvidence,
  "逐頁轉錄這份上傳的國立政治大學成績單。只輸出實際看得到的課名、課號、學分、成績和學期標題。不要輸出姓名、學號、生日或學生系所。",
  "先找出頁面、欄位或表格中正式標示的學年度和學期，再將其下方的課程放到對應 periods 群組。學年度只抄標題中的年份數字到 yearLabel，學期只抄標題中的學期值到 semesterLabel。例如印有「110學年度第1學期」，兩欄分別抄成 110 和 1。西元年份也按原樣抄錄。",
  "成績、學分、就讀期間以外的日期、頁碼及課號都不能當作學年度。無法確認哪個學年度或哪個學期對應某筆課程時，將相應欄位留空，不要補猜。若同一列有上學期和下學期兩個成績欄，把有印出課程資料的兩欄分別放到對應群組。左右不同學期的清單各自沿用自己的標題。",
  "按印刷順序逐列抄錄，包括跨行的課名，維持同一行課名、成績與學分的對應。課名模糊但可確認是課程列，且可辨識到課號、學分或成績時，仍輸出該列，課名留空。",
  "只轉錄原檔中的課程，不補入常見課程、範例課程或缺失的行。課號沒有印出就留空。成績須保留原樣，包括數字、等第、W、P 或抵免。若成績模糊則留空讓使用者補填。略過校名、斜向重複的 NATIONAL CHENGCHI UNIVERSITY 浮水印及其片段、空白列和統計列。無法看出任何課程時回傳空的 periods。依指定 JSON schema 回傳。",
].join("\n");
const ocrResult = z.object({
  transcriptVisible: z.boolean(),
  periods: z.array(z.object({
    yearLabel: z.string(),
    semesterLabel: z.string(),
    courses: z.array(z.object({
      courseCode: z.string(),
      courseName: z.string(),
      credits: z.number().finite().nullable(),
      gradeRaw: z.string(),
      confidence: z.number().finite(),
    })),
  })),
});

const layoutResult = z.object({
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  orientationConfirmed: z.boolean(),
  columns: z.array(z.object({
    left: z.number().int().min(0).max(1000),
    top: z.number().int().min(0).max(1000),
    right: z.number().int().min(0).max(1000),
    bottom: z.number().int().min(0).max(1000),
    expectedRows: z.number().int().min(1).max(300).nullable(),
    annual: z.boolean(),
  })).max(6),
});

const layoutInstructions = [
  "四張圖為同一頁的四個方向。即使檔案已裁去頁首，仍以可順讀的學年度、第一學期、第二學期、科目、學分和成績等表頭判斷方向，填入該圖標記的旋轉角度。無法確認時填 orientationConfirmed=false、rotation=0、columns=[]。",
  "只在選定的圖上定位橫向並排的課程表區塊，依左至右排列。每區包含整組課名欄、相鄰學分與成績欄、區內所有學年度和學期表頭。上下排列且共用同一組欄位的課表一起保留。不可把一組課表中的課名、學分、成績分成不同區塊。邊界應涵蓋完整字行，避免頁首個資。座標以該張圖左上為 (0,0)、右下為 (1000,1000)，不含其他圖。找不到清楚的課表界線時回傳空的 columns。",
  "一個學年度標題下面有共用的科目欄，以及右側第一學期、第二學期兩組學分和成績欄時，要把標題與所有這些欄合為一個區塊，設 annual=true。即使整張圖只有這一個學年度也一樣。括號內的起迄日期不構成另一個學年度。區內多個學年度或左右學期各有獨立科目欄時，設 annual=false。",
  "逐區估計可見的學期成績筆數 expectedRows。要算模糊但看得出對應學分或成績的課程列，同一課名若兩學期都印有資料則算兩筆。忽略表頭、空白和統計列。一個課名分行印出仍只算該學期一筆。無法可靠估計時填 null。只回傳方向與版面，勿抄錄任何個資或課程內容。",
].join("\n");

const schemaObject = (properties: Record<string, unknown>) => ({
  type: "object", additionalProperties: false, properties, required: Object.keys(properties),
});
const layoutSchema = schemaObject({
  rotation: { type: "integer", enum: transcriptScanRotations },
  orientationConfirmed: { type: "boolean" },
  columns: { type: "array", items: schemaObject({
    left: { type: "integer" }, top: { type: "integer" }, right: { type: "integer" }, bottom: { type: "integer" },
    expectedRows: { type: ["integer", "null"] }, annual: { type: "boolean" },
  }) },
});
const courseSchema = schemaObject({
  transcriptVisible: { type: "boolean" },
  periods: { type: "array", items: schemaObject({
    yearLabel: { type: "string" },
    semesterLabel: { type: "string" },
    courses: { type: "array", items: schemaObject({
      courseCode: { type: "string" }, courseName: { type: "string" }, credits: { type: ["number", "null"] },
      gradeRaw: { type: "string" }, confidence: { type: "number" },
    }) },
  }) },
});

const gridSlots = z.array(z.object({ line: z.number().int().min(1).max(26), upper: z.boolean(), lower: z.boolean() })).min(1).max(26)
  .refine((slots) => slots.every(({ line }, index) => line === index + 1));
const yearHeading = { academicYear: z.string(), beginningYear: z.string(), endingYear: z.string(), transcriptVisible: z.boolean() };
const yearLine = {
  courseName: z.string(), upperCredits: z.number().nullable(), upperGrade: z.string(),
  lowerCredits: z.number().nullable(), lowerGrade: z.string(),
};
const gridReading = z.object({
  ...yearHeading,
  courses: z.array(z.object({ line: z.number().int(), ...yearLine })),
});
const intactReading = z.object({
  ...yearHeading,
  courses: z.array(z.object({ ...yearLine, upperPresent: z.boolean(), lowerPresent: z.boolean() })),
});
const yearHeadingSchema = {
  academicYear: { type: "string" }, beginningYear: { type: "string" }, endingYear: { type: "string" }, transcriptVisible: { type: "boolean" },
};
const yearLineSchema = {
  courseName: { type: "string" },
  upperCredits: { type: ["number", "null"] }, upperGrade: { type: "string" },
  lowerCredits: { type: ["number", "null"] }, lowerGrade: { type: "string" },
};
const gridSchema = schemaObject({
  ...yearHeadingSchema,
  courses: { type: "array", items: schemaObject({
    line: { type: "integer" }, ...yearLineSchema,
  }) },
});
const intactSchema = schemaObject({
  ...yearHeadingSchema,
  courses: { type: "array", items: schemaObject({
    ...yearLineSchema, upperPresent: { type: "boolean" }, lowerPresent: { type: "boolean" },
  }) },
});
const yearHeadingInstructions = "這是國立政治大學掃描成績單的一個學年度欄。academicYear 只抄最上方「學年度」正前方的年。beginningYear 和 endingYear 分別抄同一行括號內起始年和結束年。括號內日期不分配給學期。依各位置原文抄錄，看不清楚就留空。";
const intactInstructions = [
  transcriptEvidence,
  yearHeadingInstructions,
  "由上到下逐列抄錄，每個實際橫列在 courses 只輸出一筆。左側是唯一的科目欄，中間一組學分和成績屬於第一學期（upper），最右一組屬於第二學期（lower）。同一橫列兩組都有資料時，填入同一筆的 upper 和 lower 欄位，共用一個課名。若只有最右一組有資料，只填 lower，不能移到 upper。",
  "有印學分或成績時將該組 present 設為 true。該組只有空白或橫線時設為 false，學分填 null，成績留空。W、IP、P 與等第是成績，照印刷原樣保留。不要跨列取值，成績看不清楚就留空。",
  "兩邊都沒有學分或成績的續行只接回上一個課名。只看得到空白、橫線或背景字的行，不另列成一門課。",
  "逐字抄讀水平印刷的課名，跨行的課名接回原橫列。看不清楚的課名留空。略過［以下空白］、統計、校名、背景圖案與重複的 NATIONAL CHENGCHI UNIVERSITY 浮水印片段。只抄原圖中的課程，不猜測或以常見課名替換。不要輸出任何學生個資。",
].join("\n");
const gridInstructions = [
  transcriptEvidence,
  yearHeadingInstructions,
  "所有橫列左側加了藍色序號。逐一依序號抄讀。只有一欄科目，右邊第一組學分與成績屬於上學期，第二組屬於下學期。保留括號、數字、等第、W、P、抵免等原內容。分隔用的短橫線代表無資料，勿填數值。",
  "序號對應每條印刷行。給定序號的兩個已定位成績格只讀該行，不跨行找分數。可能有一個科目名稱印成兩行，把下一行的接續文字接回原課名，接續行不另輸出。沒有成績的獨立課名仍可抄其名稱。略過［以下空白］、統計及空白。每個序號至多回傳一次，讀不清楚的欄位留空，不要猜常見課名。",
  "斜向重複的 NATIONAL CHENGCHI UNIVERSITY 是背景浮水印。遇到校名、浮水印或裁切後剩下的片段，忽略背景文字，只抄水平印刷的課程資料。",
].join("\n");

type YearLine = z.infer<typeof gridReading>["courses"][number] | z.infer<typeof intactReading>["courses"][number];

function mapYearLine(year: string, earliestYear: string, entry: YearLine | undefined, slot?: TranscriptGridSlot) {
  const courseName = entry?.courseName.trim() ?? "";
  const printed = entry && "upperPresent" in entry ? entry : undefined;
  return transcriptRowsFromYearLine({
    year, earliestYear, courseName, numbered: Boolean(slot),
    upper: { present: slot?.upper ?? printed?.upperPresent, credits: entry?.upperCredits, grade: entry?.upperGrade },
    lower: { present: slot?.lower ?? printed?.lowerPresent, credits: entry?.lowerCredits, grade: entry?.lowerGrade },
  }).map((row) => row.ungraded ? row : {
    ...row, candidates: courseName ? matchNccuCourse(courseName, row.credits, row.term) : [],
  });
}

function mapGridRows(result: z.infer<typeof gridReading>, slots: TranscriptGridSlot[], earliestYear: string) {
  const year = resolveTranscriptYearHeader(result);
  const pageText = new Set(result.courses.filter(({ courseName }) => isTranscriptPageText(courseName)));
  const discardedLines = new Set([...pageText].map(({ line }) => line));
  const courses = result.courses.filter((course) => !pageText.has(course));
  const counts = new Map<number, number>();
  for (const { line } of courses) counts.set(line, (counts.get(line) ?? 0) + 1);
  const byLine = new Map(courses.filter(({ line }) => counts.get(line) === 1).map((course) => [course.line, course]));
  const rows = slots.flatMap<TranscriptRow>((slot) => {
    const entry = byLine.get(slot.line);
    if (!entry && discardedLines.has(slot.line)) return [];
    return mapYearLine(year, earliestYear, entry, slot);
  });
  return { rows, discardedPageText: pageText.size };
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function extractOutputText(payload: unknown) {
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) if (content.type === "output_text" && content.text) return content.text;
  }
  return null;
}

async function ocrFileContent(file: File) {
  const dataUrl = `data:${file.type};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
  return file.type === "application/pdf"
    ? { type: "input_file", filename: "transcript.pdf", file_data: dataUrl, detail: "high" }
    : { type: "input_image", image_url: dataUrl, detail: "high" };
}

async function requestOcr(content: Record<string, unknown>[], name: string, schema: ReturnType<typeof schemaObject>, signal: AbortSignal) {
  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    signal,
    body: JSON.stringify({
      model: env.OPENAI_OCR_MODEL ?? "gpt-4.1",
      store: false,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  }).catch(() => null);

  if (!openAiResponse?.ok) {
    if (openAiResponse?.status === 429) {
      const upstream = await openAiResponse.json().catch(() => null) as { error?: { code?: string } } | null;
      if (upstream?.error?.code === "credit_balance_exhausted" || upstream?.error?.code === "insufficient_quota") {
        return { error: NextResponse.json({ error: "OCR 的 OpenAI API 額度已用完，請補充額度後再試。", code: "OCR_QUOTA_EXHAUSTED" }, { status: 502 }) };
      }
    }
    return { error: NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 502 }) };
  }

  const payload = await openAiResponse.json().catch(() => null);
  const outputText = payload ? extractOutputText(payload) : null;
  try {
    return { value: outputText ? JSON.parse(outputText) as unknown : null };
  } catch {
    return { value: null };
  }
}

function emptyOcrResult() {
  return NextResponse.json({ rows: [], discardedPageText: 0, originalFileStored: false });
}

export async function POST(request: Request) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入後再辨識成績單" }, { status: 401 });
  if (!env.OPENAI_API_KEY) return NextResponse.json({ error: "OCR 尚未設定 OPENAI_API_KEY，無法辨識這份成績單。", code: "OCR_NOT_CONFIGURED" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "無法讀取上傳的資料" }, { status: 400 });

  if (form.get("mode") === "layout") {
    const previews = form.getAll("preview").filter((file): file is File => file instanceof File
      && file.type === "image/jpeg" && file.size > 0 && file.size <= 1024 * 1024);
    if (previews.length !== transcriptScanRotations.length || form.getAll("preview").length !== previews.length) {
      return NextResponse.json({ error: "無法讀取成績單的方向預覽" }, { status: 400 });
    }
    const directions = await Promise.all(previews.map(async (preview, index) => [
      { type: "input_text", text: `順時針旋轉 ${transcriptScanRotations[index]} 度` }, await ocrFileContent(preview),
    ]));
    const response = await requestOcr([{ type: "input_text", text: layoutInstructions }, ...directions.flat()],
      "nccu_transcript_layout", layoutSchema, request.signal);
    if (response.error) return response.error;
    const layout = layoutResult.safeParse(response.value);
    return NextResponse.json({ layout: layout.success ? layout.data : null });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "請選擇成績單檔案" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "只支援 PDF、JPG、PNG 或 WebP" }, { status: 415 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "檔案不可超過 10 MB" }, { status: 413 });
  const earliestYearInput = form.get("earliestYear");
  const earliestYear = typeof earliestYearInput === "string" ? normalizeTranscriptAcademicYear(earliestYearInput) : "";
  if (earliestYearInput && !earliestYear) return NextResponse.json({ error: "請輸入有效的最早學年度，例如 110。" }, { status: 400 });
  const mode = form.get("mode");
  if (mode === "grid") {
    let slots: unknown;
    try { slots = JSON.parse(String(form.get("slots"))); } catch { slots = null; }
    const parsedSlots = gridSlots.safeParse(slots);
    if (file.type !== "image/jpeg" || !parsedSlots.success) {
      return NextResponse.json({ error: "無法讀取成績單的列位置" }, { status: 400 });
    }
    const response = await requestOcr([
      await ocrFileContent(file),
      { type: "input_text", text: `${gridInstructions}\n列位置與已定位的上、下學期成績格（false 表示原格為空或橫線）${JSON.stringify(parsedSlots.data)}` },
    ], "nccu_transcript_numbered_rows", gridSchema, request.signal);
    if (response.error) return response.error;
    const result = gridReading.safeParse(response.value);
    if (!result.success) return NextResponse.json({ error: "OCR 回傳的課程格式無法讀取" }, { status: 502 });
    if (!result.data.transcriptVisible) return emptyOcrResult();
    return NextResponse.json({ ...mapGridRows(result.data, parsedSlots.data, earliestYear), originalFileStored: false });
  }
  if (mode === "intact") {
    const response = await requestOcr([
      await ocrFileContent(file), { type: "input_text", text: intactInstructions },
    ], "nccu_transcript_year_rows", intactSchema, request.signal);
    if (response.error) return response.error;
    const result = intactReading.safeParse(response.value);
    if (!result.success) return NextResponse.json({ error: "OCR 回傳的課程格式無法讀取" }, { status: 502 });
    if (!result.data.transcriptVisible) return emptyOcrResult();
    const { courses } = result.data;
    const year = resolveTranscriptYearHeader(result.data);
    const actualCourses = courses.filter(({ courseName }) => !isTranscriptPageText(courseName));
    const rows = actualCourses.flatMap((course) => mapYearLine(year, earliestYear, course)).filter((row) => !row.ungraded);
    return NextResponse.json({ rows, discardedPageText: courses.length - actualCourses.length, originalFileStored: false });
  }
  const scanInstructions = mode === "retry"
    ? "這是一個課程區塊。請從上到下用對應的學分與成績欄逐行回查，特別留意區塊開頭、換學期的前後及最末的課程列。"
    : mode === "column" ? "這是一個課程區塊，只抄錄此區實際可見的課程。" : "";
  const response = await requestOcr([
    await ocrFileContent(file), { type: "input_text", text: `${ocrInstructions}\n${scanInstructions}` },
  ], "nccu_transcript_courses", courseSchema, request.signal);
  if (response.error) return response.error;
  const result = ocrResult.safeParse(response.value);
  if (!result.success) return NextResponse.json({ error: "OCR 回傳的課程格式無法讀取" }, { status: 502 });
  if (!result.data.transcriptVisible) return emptyOcrResult();
  let discardedPageText = 0;
  const rows = result.data.periods.flatMap(({ yearLabel, semesterLabel, courses }) => {
    const period = resolveOcrTranscriptPeriod(yearLabel, semesterLabel, earliestYear);
    return courses.flatMap((course) => {
      const courseName = course.courseName.trim();
      if (isTranscriptPageText(courseName)) {
        discardedPageText++;
        return [];
      }
      const courseCode = course.courseCode.trim();
      const dash = isTranscriptGradeDash(course.gradeRaw);
      if (dash && course.credits === null && !courseCode) return [];
      const gradeRaw = dash ? "" : course.gradeRaw.trim();
      if (!courseName && !courseCode && !gradeRaw && course.credits === null) return [];
      const candidates = courseName ? matchNccuCourse(courseName, course.credits, period.term) : [];
      const [best] = candidates;
      return {
        id: `ocr-${crypto.randomUUID()}`,
        ...period,
        courseCode,
        courseName,
        credits: course.credits,
        gradeRaw,
        confidence: Math.min(course.confidence, best?.confidence ?? course.confidence * 0.55),
        candidates,
      };
    });
  });
  return NextResponse.json({ rows, discardedPageText, originalFileStored: false });
}
