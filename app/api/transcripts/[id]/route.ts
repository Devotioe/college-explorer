import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "../../../../db";
import { transcriptUploads } from "../../../../db/schema";
import { getCurrentPasswordUser } from "../../../../lib/password-auth";
import { ownedTranscript, readTranscriptLibrary, readTranscriptRows } from "../../../../lib/transcript-library";
import { transcriptFileNameLimit } from "../../../../lib/transcript-review";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.union([
  z.object({ fileName: z.string().trim().min(1).max(transcriptFileNameLimit) }).strict(),
  z.object({ active: z.literal(true) }).strict(),
]);

export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { id } = await params;
  const [record] = await getDb().select().from(transcriptUploads).where(ownedTranscript(user.id, id)).limit(1);
  if (!record) return NextResponse.json({ error: "找不到成績單" }, { status: 404 });
  return NextResponse.json({ transcript: { ...record, rows: await readTranscriptRows(id) } });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const { id } = await params;
  const update = updateSchema.safeParse(await request.json().catch(() => null));
  if (!update.success) return NextResponse.json({ error: "請輸入有效的成績單檔名，最多 160 字。" }, { status: 400 });

  if ("fileName" in update.data) {
    const [record] = await getDb().update(transcriptUploads).set({ fileName: update.data.fileName })
      .where(ownedTranscript(user.id, id)).returning({ id: transcriptUploads.id });
    if (!record) return NextResponse.json({ error: "找不到成績單" }, { status: 404 });
  } else {
    const selection = await env.DB.prepare(`INSERT INTO transcript_analysis_sources (user_id, transcript_id)
      SELECT user_id, id FROM transcript_uploads WHERE id = ? AND user_id = ? AND status = 'confirmed' AND file_type <> 'sample'
      ON CONFLICT (user_id) DO UPDATE SET transcript_id = excluded.transcript_id RETURNING transcript_id`)
      .bind(id, user.id).first();
    if (!selection) return NextResponse.json({ error: "找不到成績單" }, { status: 404 });
  }
  return NextResponse.json(await readTranscriptLibrary(user.id));
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentPasswordUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { id } = await params;
  const [record] = await getDb().delete(transcriptUploads).where(ownedTranscript(user.id, id)).returning({ id: transcriptUploads.id });
  if (!record) return NextResponse.json({ error: "找不到成績單" }, { status: 404 });
  return NextResponse.json(await readTranscriptLibrary(user.id));
}
