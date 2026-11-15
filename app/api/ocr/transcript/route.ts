import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";
import { matchNccuCourse } from "../../../../lib/nccu-course-match";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

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
          { type: "input_text", text: "辨識這份國立政治大學成績單。只抽取各學期的課程列，不要輸出或保留姓名、學號、生日、系所等個人識別資訊。將學期正規化為民國學年度-學期，例如 110-1。成績可能是數字、W、P、抵免或空白；空白列不要輸出。請以指定 JSON schema 回傳。" },
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
                    courseName: { type: "string" },
                    credits: { type: ["number", "null"] },
                    gradeRaw: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["term", "courseName", "credits", "gradeRaw", "confidence"],
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
    const detail = await openAiResponse.json().catch(() => null) as { error?: { message?: string } } | null;
    return NextResponse.json({ error: detail?.error?.message ?? "OCR 服務暫時無法使用" }, { status: 502 });
  }

  const payload = await openAiResponse.json();
  const outputText = extractOutputText(payload);
  if (!outputText) return NextResponse.json({ error: "OCR 沒有回傳可讀取的課程資料" }, { status: 502 });
  const parsed = JSON.parse(outputText) as { courses: Array<{ term: string; courseName: string; credits: number | null; gradeRaw: string; confidence: number }> };
  const rows = parsed.courses.map((course, index) => {
    const candidates = matchNccuCourse(course.courseName, course.credits, course.term);
    const best = candidates[0];
    return {
      id: `ocr-${index}-${crypto.randomUUID()}`,
      term: course.term,
      courseCode: best?.code ?? "",
      courseName: course.courseName,
      credits: course.credits,
      gradeRaw: course.gradeRaw,
      confidence: Math.min(course.confidence, best?.confidence ?? course.confidence * 0.55),
      candidates,
    };
  });
  return NextResponse.json({ rows, originalFileStored: false });
}
