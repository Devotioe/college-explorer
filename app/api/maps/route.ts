import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { recommendationMaps } from "../../../db/schema";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登入" }, { status: 401 });
  const maps = await getDb().select({ id: recommendationMaps.id, name: recommendationMaps.name, payload: recommendationMaps.payload, createdAt: recommendationMaps.createdAt, updatedAt: recommendationMaps.updatedAt }).from(recommendationMaps).where(eq(recommendationMaps.userId, user.userId)).orderBy(desc(recommendationMaps.updatedAt));
  return NextResponse.json({ maps });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登入" }, { status: 401 });
  const body = await request.json() as { name?: string; payload?: unknown };
  const name = body.name?.trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "請輸入地圖名稱" }, { status: 400 });
  const payload = JSON.stringify(body.payload ?? {});
  if (payload.length > 100_000) return NextResponse.json({ error: "地圖內容過大" }, { status: 413 });
  const now = new Date();
  const map = { id: crypto.randomUUID(), userId: user.userId, name, payload, createdAt: now, updatedAt: now };
  await getDb().insert(recommendationMaps).values(map);
  return NextResponse.json({ map: { ...map, userId: undefined } }, { status: 201 });
}
