import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";
import { matchNccuCourse } from "../../../../lib/nccu-course-match";
import { normalizeTranscriptTerm } from "../../../../lib/transcript-review";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const ocrResult = z.object({
  courses: z.array(z.object({
    term: z.string(),
    courseCode: z.string(),
    courseName: z.string(),
    credits: z.number().finite().nullable(),
    gradeRaw: z.string(),
    confidence: z.number().finite(),
  })),
});

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

export async function POST(request: Request) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入後再辨識成績單" }, { status: 401 });
  if (!env.OPENAI_API_KEY) return NextResponse.json({ error: "尚未設定 OPENAI_API_KEY，可先使用畫面中的範例辨識結果測試流程。", code: "OCR_NOT_CONFIGURED" }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "請選擇成績單檔案" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "只支援 PDF、JPG、PNG 或 WebP" }, { status: 415 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "檔案不可超過 10 MB" }, { status: 413 });

  const dataUrl = `data:${file.type};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
  const fileContent = file.type === "application/pdf"
    ? { type: "input_file", filename: file.name, file_data: dataUrl, detail: "high" }
    : { type: "input_image", image_url: dataUrl, detail: "high" };

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.OPENAI_OCR_MODEL ?? "gpt-4.1",
      store: false,
      input: [{
        role: "user",
        content: [
          fileContent,
          { type: "input_text", text: "辨識這份國立政治大學成績單。只抽取課程、學期、學分與成績，不要輸出姓名、學號、生日或學生系所。依各頁、各欄實際印出的學年度與學期標題判讀。若同一列有上學期、下學期兩欄，分別輸出該欄的課程紀錄，學分與成績不可移到另一欄。若左右欄為不同學期的課程清單，各自沿用自己的學期標題。學期用民國學年度-學期（例如 113-1 為上學期、113-2 為下學期、113-3 為暑修）。只辨識到學年度時只填該年度，兩者都無法辨識時留空。courseCode 只填文件印出的課號，沒有就留空。gradeRaw 保留原本的數字、等第、W、P 或抵免。能看見課名但成績模糊時保留該課，成績留空讓使用者補填。略過空白列及平均、排名、學分總計等統計列。依指定 JSON schema 回傳。" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "nccu_transcript_courses",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              courses: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    term: { type: "string" },
                    courseCode: { type: "string" },
                    courseName: { type: "string" },
                    credits: { type: ["number", "null"] },
                    gradeRaw: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["term", "courseCode", "courseName", "credits", "gradeRaw", "confidence"],
                },
              },
            },
            required: ["courses"],
          },
        },
      },
    }),
  });

  if (!openAiResponse.ok) {
    return NextResponse.json({ error: "OCR 服務暫時無法使用" }, { status: 502 });
  }

  const payload = await openAiResponse.json();
  const outputText = extractOutputText(payload);
  if (!outputText) return NextResponse.json({ error: "OCR 沒有回傳可讀取的課程資料" }, { status: 502 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return NextResponse.json({ error: "OCR 回傳的課程格式無法讀取" }, { status: 502 });
  }
  const result = ocrResult.safeParse(parsed);
  if (!result.success) return NextResponse.json({ error: "OCR 回傳的課程格式無法讀取" }, { status: 502 });
  const rows = result.data.courses.filter((course) => course.courseName.trim()).map((course, index) => {
    const term = normalizeTranscriptTerm(course.term);
    const candidates = matchNccuCourse(course.courseName, course.credits, term);
    const [best, next] = candidates;
    const suggestedCode = best && best.confidence >= .94 && (!next || best.confidence - next.confidence > .04)
      ? best.code : "";
    return {
      id: `ocr-${index}-${crypto.randomUUID()}`,
      term,
      courseCode: course.courseCode.trim() || suggestedCode,
      courseName: course.courseName,
      credits: course.credits,
      gradeRaw: course.gradeRaw,
      confidence: Math.min(course.confidence, best?.confidence ?? course.confidence * 0.55),
      candidates,
    };
  });
  return NextResponse.json({ rows, originalFileStored: false });
}
