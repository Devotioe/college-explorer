import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

export async function GET(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const url = new URL(request.url);
  const page = numberParam(url.searchParams.get("page"), 1, 1, 10000);
  const pageSize = numberParam(url.searchParams.get("pageSize"), 60, 1, 500);
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const school = url.searchParams.get("school")?.trim() ?? "";
  const level = url.searchParams.get("level")?.trim() ?? "";
  const language = url.searchParams.get("language")?.trim() ?? "";
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (query) {
    clauses.push("(lower(c.title_zh) LIKE ? OR lower(c.title_en) LIKE ? OR lower(c.code) LIKE ? OR lower(c.department) LIKE ? OR lower(c.topics) LIKE ? OR lower(coalesce(c.description, '')) LIKE ? OR lower(coalesce(c.objectives, '')) LIKE ?)");
    const like = `%${query}%`;
    bindings.push(like, like, like, like, like, like, like);
  }
  if (school) { clauses.push("c.school = ?"); bindings.push(school); }
  if (level) { clauses.push("c.level = ?"); bindings.push(level); }
  if (language) { clauses.push("o.language = ?"); bindings.push(language); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const baseJoin = `FROM courses c LEFT JOIN course_offerings o ON o.id = (SELECT id FROM course_offerings x WHERE x.course_id = c.id ORDER BY x.semester DESC, x.id LIMIT 1)`;
  const countRow = await env.DB.prepare(`SELECT count(*) AS total ${baseJoin} ${where}`).bind(...bindings).first<{ total: number }>();
  const rows = await env.DB.prepare(`
    SELECT c.id, c.school, c.code, c.title_zh AS titleZh, c.title_en AS titleEn,
      c.department, c.credits, c.level, c.topics,
      substr(coalesce(c.description, ''), 1, 600) AS description,
      substr(coalesce(c.objectives, ''), 1, 600) AS objectives,
      o.semester, o.teacher,
      o.language, o.schedule, o.capacity
    ${baseJoin} ${where}
    ORDER BY c.school, c.code
    LIMIT ? OFFSET ?
  `).bind(...bindings, pageSize, (page - 1) * pageSize).all();
  return NextResponse.json({
    courses: rows.results,
    pagination: { page, pageSize, total: Number(countRow?.total ?? 0), pages: Math.ceil(Number(countRow?.total ?? 0) / pageSize) },
  });
}
