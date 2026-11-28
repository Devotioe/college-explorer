import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { correctNccuTranscriptTitles } from "../../../../../lib/nccu-course-match";
import { getCurrentPasswordUser } from "../../../../../lib/password-auth";

const readings = z.array(z.object({
  id: z.string().max(100), sourceLine: z.string().max(100).optional(), courseName: z.string().max(500),
  term: z.string().max(20), credits: z.number().finite().nullable(),
})).max(1000);

function parseTerms(value: string | null) {
  try {
    const terms: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(terms) ? terms.filter((term): term is string => typeof term === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const database = env.DB;
  if (!database) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  if (!await getCurrentPasswordUser()) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const parsed = readings.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "課名配對資料格式有誤。" }, { status: 400 });
  const { results } = await database.prepare(
    "SELECT code, title_zh AS title, title_en AS titleEn, department, credits, offered_terms AS offeredTerms FROM courses WHERE school = ? ORDER BY code",
  ).bind("NCCU").all<{ code: string; title: string; titleEn: string; department: string; credits: number; offeredTerms: string | null }>();
  const courses = results.map((course) => ({ ...course, offeredTerms: parseTerms(course.offeredTerms) }));
  return NextResponse.json({ corrections: correctNccuTranscriptTitles(parsed.data, courses) });
}
