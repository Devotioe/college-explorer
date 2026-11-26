import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";
import { matchNccuCourse } from "../../../../lib/nccu-course-match";
import { normalizeTranscriptAcademicYear, resolveOcrTranscriptPeriod, type TranscriptRow } from "../../../../lib/transcript-review";
import { transcriptScanRotations } from "../../../../lib/transcript-scan-layout";
import type { TranscriptGridSlot } from "../../../../lib/nccu-transcript-grid";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ocrInstructions = [
  "逐頁轉錄這份上傳的國立政治大學成績單。只輸出實際看得到的課名、課號、學分、成績和學期標題。不要輸出姓名、學號、生日或學生系所。",
  "先找出頁面、欄位或表格中正式標示的學年度和學期，再將其下方的課程放到對應 periods 群組。學年度只抄標題中的年份數字到 yearLabel，學期只抄標題中的學期值到 semesterLabel。例如印有「110學年度第1學期」，兩欄分別抄成 110 和 1。西元年份也按原樣抄錄。",
  "成績、學分、就讀期間以外的日期、頁碼及課號都不能當作學年度。無法確認哪個學年度或哪個學期對應某筆課程時，將相應欄位留空，不要補猜。若同一列有上學期和下學期兩個成績欄，把有印出課程資料的兩欄分別放到對應群組。左右不同學期的清單各自沿用自己的標題。",
  "按印刷順序逐列抄錄，包括跨行的課名，維持同一行課名、成績與學分的對應。課名模糊但可確認是課程列，且可辨識到課號、學分或成績時，仍輸出該列，課名留空。",
  "只轉錄原檔中的課程，不補入常見課程、範例課程或缺失的行。課號沒有印出就留空。成績須保留原樣，包括數字、等第、W、P 或抵免。若成績模糊則留空讓使用者補填。略過空白列及平均、排名、學分總計等統計列。無法看出任何課程時回傳空的 periods。依指定 JSON schema 回傳。",
].join("\n");
const ocrResult = z.object({
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
  })).max(6),
});

const layoutInstructions = [
  "四張圖為同一頁的四個方向。依照可順讀的「國立政治大學」、「學生成績單」、「科目名稱」、「學分」、「成績」或學年學期表頭，選擇方向，填入該圖標記的旋轉角度。無法確認時填 orientationConfirmed=false、rotation=0、columns=[]。",
  "只在選定的圖上定位橫向並排的課程表區塊，依左至右排列。每區包含整組課名欄、相鄰學分與成績欄、區內所有學年度和學期表頭。上下排列且共用同一組欄位的課表一起保留。不可把一組課表中的課名、學分、成績分成不同區塊。邊界應涵蓋完整字行，避免頁首個資。座標以該張圖左上為 (0,0)、右下為 (1000,1000)，不含其他圖。找不到清楚的課表界線時回傳空的 columns。",
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
    expectedRows: { type: ["integer", "null"] },
  }) },
});
const courseSchema = schemaObject({
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
const gridReading = z.object({
  academicYear: z.string(), beginningYear: z.string(), endingYear: z.string(),
  courses: z.array(z.object({
    line: z.number().int(), courseName: z.string(),
    upperCredits: z.number().nullable(), upperGrade: z.string(), lowerCredits: z.number().nullable(), lowerGrade: z.string(),
  })),
});
const gridSchema = schemaObject({
  academicYear: { type: "string" }, beginningYear: { type: "string" }, endingYear: { type: "string" },
  courses: { type: "array", items: schemaObject({
    line: { type: "integer" }, courseName: { type: "string" },
    upperCredits: { type: ["number", "null"] }, upperGrade: { type: "string" },
    lowerCredits: { type: ["number", "null"] }, lowerGrade: { type: "string" },
  }) },
});
const gridInstructions = [
  "這是國立政治大學掃描成績單的一個學年度欄。最高處為學年度和括號內的起迄日期。academicYear 僅抄印在「學年度」正前方的年。beginningYear 和 endingYear 分別抄括號內起始年和結束年。以原圖每個位置所印的字為準，不推算年份；看不清楚就留空。",
  "所有橫列左側加了藍色序號。逐一依序號抄讀。只有一欄科目，右邊第一組學分與成績屬於上學期，第二組屬於下學期。保留括號、數字、等第、W、P、抵免等原內容。分隔用的短橫線代表無資料，勿填數值。",
  "序號對應每條印刷行。給定序號的兩個已定位成績格只讀該行，不跨行找分數。可能有一個科目名稱印成兩行，把下一行的接續文字接回原課名，接續行不另輸出。沒有成績的獨立課名仍可抄其名稱。略過［以下空白］、統計及空白。每個序號至多回傳一次，讀不清楚的欄位留空，不要猜常見課名。",
].join("\n");

function readPrintedGrade(value: string | undefined) {
  const grade = value?.normalize("NFKC").trim() ?? "";
  if (/^\d{1,3}(?:\.\d{1,2})?$/u.test(grade)) return Number(grade) <= 100 ? grade : "";
  return /^(?:[A-FIPRSUW][+-]?|通過|不通過|抵免|免修|退選|停修|及格|不及格)$/iu.test(grade) ? grade.toUpperCase() : "";
}

function readPrintedCredits(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 20 ? value : null;
}

function mapGridRows(result: z.infer<typeof gridReading>, slots: TranscriptGridSlot[], earliestYear: string) {
  const year = normalizeTranscriptAcademicYear(result.academicYear);
  const beginningYear = normalizeTranscriptAcademicYear(result.beginningYear);
  const endingYear = normalizeTranscriptAcademicYear(result.endingYear);
  const verifiedYear = year && year === beginningYear && Number(endingYear) === Number(year) + 1 ? year : "";
  const counts = new Map<number, number>();
  for (const { line } of result.courses) counts.set(line, (counts.get(line) ?? 0) + 1);
  const byLine = new Map(result.courses.filter(({ line }) => counts.get(line) === 1).map((course) => [course.line, course]));
  return slots.flatMap<TranscriptRow>(({ line, upper, lower }) => {
    const entry = byLine.get(line);
    const printedTitle = entry?.courseName.trim() ?? "";
    const courseName = /以下\s*空白|(?:平均|排名|學分)(?:總計|合計)|^(?:科\s*目|課名)$/u.test(printedTitle) ? "" : printedTitle;
    const sourceLine = `ocr-${crypto.randomUUID()}`;
    if (!upper && !lower) {
      return courseName ? [{ id: sourceLine, ...resolveOcrTranscriptPeriod(verifiedYear, "", earliestYear),
        courseName, courseCode: "", credits: null, gradeRaw: "", confidence: .7, ungraded: true as const }] : [];
    }
    return ([{ present: upper, semester: "1", credits: entry?.upperCredits, grade: entry?.upperGrade },
      { present: lower, semester: "2", credits: entry?.lowerCredits, grade: entry?.lowerGrade }])
      .filter(({ present }) => present).map(({ semester, credits, grade }) => {
        const period = resolveOcrTranscriptPeriod(verifiedYear, semester, earliestYear);
        const safeCredits = readPrintedCredits(credits);
        const gradeRaw = readPrintedGrade(grade);
        const candidates = courseName ? matchNccuCourse(courseName, safeCredits, period.term) : [];
        const [best, next] = candidates;
        const courseCode = best && best.confidence >= .94 && (!next || best.confidence - next.confidence > .04) ? best.code : "";
        return { id: `${sourceLine}-${semester}`, ...period, sourceLine,
          courseName, courseCode, credits: safeCredits, gradeRaw, confidence: entry ? .85 : 0, candidates,
          requiresOcrReview: !courseName || !gradeRaw ? true as const : undefined };
      });
  });
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

export async function POST(request: Request) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入後再辨識成績單" }, { status: 401 });
  if (!env.OPENAI_API_KEY) return NextResponse.json({ error: "尚未設定 OPENAI_API_KEY，可先使用畫面中的範例辨識結果測試流程。", code: "OCR_NOT_CONFIGURED" }, { status: 503 });

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
    return NextResponse.json({ rows: mapGridRows(result.data, parsedSlots.data, earliestYear), originalFileStored: false });
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
  const rows = result.data.periods.flatMap(({ yearLabel, semesterLabel, courses }) => {
    const period = resolveOcrTranscriptPeriod(yearLabel, semesterLabel, earliestYear);
    return courses.filter(({ courseName, courseCode, gradeRaw, credits }) =>
      courseName.trim() || courseCode.trim() || gradeRaw.trim() || credits !== null).map((course) => {
      const courseName = course.courseName.trim();
      const candidates = courseName ? matchNccuCourse(courseName, course.credits, period.term) : [];
      const [best, next] = candidates;
      const suggestedCode = best && best.confidence >= .94 && (!next || best.confidence - next.confidence > .04)
        ? best.code : "";
      return {
        id: `ocr-${crypto.randomUUID()}`,
        ...period,
        courseCode: course.courseCode.trim() || suggestedCode,
        courseName,
        credits: course.credits,
        gradeRaw: course.gradeRaw,
        confidence: Math.min(course.confidence, best?.confidence ?? course.confidence * 0.55),
        candidates,
      };
    });
  });
  return NextResponse.json({ rows, originalFileStored: false });
}
