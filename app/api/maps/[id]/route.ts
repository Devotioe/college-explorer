import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { recommendationMaps } from "../../../../db/schema";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登入" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { name?: string };
  const name = body.name?.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "請輸入地圖名稱" }, { status: 400 });
  const rows = await getDb().update(recommendationMaps).set({ name, updatedAt: new Date() }).where(and(eq(recommendationMaps.id, id), eq(recommendationMaps.userId, user.userId))).returning({ id: recommendationMaps.id });
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "找不到地圖" }, { status: 404 });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登入" }, { status: 401 });
  const { id } = await context.params;
  const rows = await getDb().delete(recommendationMaps).where(and(eq(recommendationMaps.id, id), eq(recommendationMaps.userId, user.userId))).returning({ id: recommendationMaps.id });
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "找不到地圖" }, { status: 404 });
}
