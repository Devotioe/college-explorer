import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../db";
import { transcriptUploads } from "../../../db/schema";
import { getCurrentPasswordUser } from "../../../lib/password-auth";

const confirmedTranscript = z.object({
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  rows: z.array(z.object({
    term: z.string().optional(),
    courseCode: z.string().optional(),
    courseName: z.string().optional(),
    credits: z.number().finite().nullable().optional(),
    gradeRaw: z.string().optional(),
    confidence: z.number().finite().optional(),
  })).max(300),
});

export async function GET() {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const transcripts = await getDb().select().from(transcriptUploads).where(eq(transcriptUploads.userId, user.id)).orderBy(desc(transcriptUploads.createdAt)).limit(30);
  if (!transcripts.length) return NextResponse.json({ transcripts: [] });
  const placeholders = transcripts.map(() => "?").join(",");
  const courseRows = await env.DB.prepare(`SELECT id, transcript_id AS transcriptId, term, course_code AS courseCode, course_name AS courseName, credits, grade_raw AS gradeRaw, match_confidence AS confidence FROM transcript_course_rows WHERE transcript_id IN (${placeholders}) ORDER BY term, course_code`).bind(...transcripts.map((item) => item.id)).all();
  const grouped = new Map<string, typeof courseRows.results>();
  for (const row of courseRows.results) {
    const key = String(row.transcriptId);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return NextResponse.json({ transcripts: transcripts.map((item) => ({ ...item, rows: grouped.get(item.id) ?? [] })) });
}

export async function POST(request: Request) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const parsed = confirmedTranscript.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "成績單格式有誤，每份最多可保存 300 筆學期成績。" }, { status: 400 });
  const body = parsed.data;
  const rows = body.rows.filter((row) => row.courseName?.trim() && row.gradeRaw?.trim());
  if (!rows.length) return NextResponse.json({ error: "沒有可儲存的課程" }, { status: 400 });
  const transcriptId = crypto.randomUUID();
  const now = Date.now();
  const statements = [env.DB.prepare("INSERT INTO transcript_uploads (id, user_id, file_name, file_type, status, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(transcriptId, user.id, (body.fileName ?? "成績單").slice(0, 160), (body.fileType ?? "unknown").slice(0, 80), "confirmed", now, now)];
  for (const row of rows) {
    const numeric = Number(row.gradeRaw);
    statements.push(env.DB.prepare("INSERT INTO transcript_course_rows (id, transcript_id, term, course_code, course_name, credits, grade_raw, grade_numeric, match_confidence, confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .bind(crypto.randomUUID(), transcriptId, (row.term ?? "").slice(0, 20), (row.courseCode ?? "").slice(0, 40), row.courseName!.trim().slice(0, 160), row.credits ?? null, row.gradeRaw!.trim().slice(0, 20), Number.isFinite(numeric) ? numeric : null, Math.min(1, Math.max(0, row.confidence ?? 0))));
  }
  await env.DB.batch(statements);
  return NextResponse.json({ transcript: { id: transcriptId, rows: rows.length, confirmedAt: now } }, { status: 201 });
}
