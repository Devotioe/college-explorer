import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import seed from "../../../../data/course-seed.json";

type SeedRecord = (typeof seed.records)[number];
const records = seed.records as SeedRecord[];

export async function GET() {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const row = await env.DB.prepare("SELECT count(*) AS total FROM courses").first<{ total: number }>();
  const nccuRow = await env.DB.prepare("SELECT count(*) AS total FROM courses WHERE school = 'NCCU' AND syllabus_url IS NOT NULL AND syllabus_url != ''").first<{ total: number }>();
  const current = Number(row?.total ?? 0);
  const expectedNccu = records.filter((record) => record.course.school === "NCCU").length;
  const imported = current === records.length && Number(nccuRow?.total ?? 0) === expectedNccu ? current : 0;
  return NextResponse.json({ imported, total: records.length, sourceRecords: seed.sourceRecords, done: imported >= records.length });
}

export async function POST(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { cursor?: number };
  const cursor = Math.max(0, Math.floor(Number(body.cursor) || 0));
  const chunk = records.slice(cursor, cursor + 150);
  const statements = [];
  if (cursor === 0) {
    statements.push(env.DB.prepare("DELETE FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE school = 'NCCU')"));
    statements.push(env.DB.prepare("DELETE FROM course_topics WHERE course_id IN (SELECT id FROM courses WHERE school = 'NCCU')"));
    statements.push(env.DB.prepare("DELETE FROM courses WHERE school = 'NCCU'"));
  }
  for (const record of chunk) {
    const course = record.course;
    statements.push(env.DB.prepare("INSERT INTO courses (id, school, code, title_zh, title_en, department, credits, level, topics, description, objectives, prerequisites, syllabus_url, syllabus_source, offered_terms, requirement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET school=excluded.school, code=excluded.code, title_zh=excluded.title_zh, title_en=excluded.title_en, department=excluded.department, credits=excluded.credits, level=excluded.level, topics=excluded.topics, description=excluded.description, objectives=excluded.objectives, prerequisites=excluded.prerequisites, syllabus_url=excluded.syllabus_url, syllabus_source=excluded.syllabus_source, offered_terms=excluded.offered_terms, requirement=excluded.requirement").bind(course.id, course.school, course.code, course.titleZh, course.titleEn, course.department, course.credits, course.level, JSON.stringify(course.topics), course.description ?? null, course.objectives ?? null, course.prerequisites ?? null, course.syllabusUrl ?? null, course.syllabusSource ?? null, JSON.stringify(course.offeredTerms ?? []), course.requirement ?? null));
    for (const topic of course.topics) {
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO course_topics (course_id, topic) VALUES (?, ?)").bind(course.id, topic));
    }
    for (const offering of record.offerings) {
      statements.push(env.DB.prepare("INSERT OR IGNORE INTO course_offerings (id, course_id, semester, section, teacher, language, schedule, capacity, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(offering.id, offering.courseId, offering.semester, offering.section, offering.teacher, offering.language, offering.schedule, offering.capacity, offering.source));
    }
  }
  for (let index = 0; index < statements.length; index += 75) {
    await env.DB.batch(statements.slice(index, index + 75));
  }
  const nextCursor = cursor + chunk.length;
  return NextResponse.json({ cursor: nextCursor, total: records.length, sourceRecords: seed.sourceRecords, done: nextCursor >= records.length });
}
