import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import seed from "../../../../data/course-seed.json";

type SeedRecord = (typeof seed.records)[number];
const records = seed.records as SeedRecord[];

export async function GET() {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const row = await env.DB.prepare("SELECT count(*) AS total FROM courses").first<{ total: number }>();
  const imported = Number(row?.total ?? 0);
  return NextResponse.json({ imported, total: records.length, sourceRecords: seed.sourceRecords, done: imported >= records.length });
}

export async function POST(request: Request) {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { cursor?: number };
  const cursor = Math.max(0, Math.floor(Number(body.cursor) || 0));
  const chunk = records.slice(cursor, cursor + 150);
  const statements = [];
  for (const record of chunk) {
    const course = record.course;
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO courses (id, school, code, title_zh, title_en, department, credits, level, topics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(course.id, course.school, course.code, course.titleZh, course.titleEn, course.department, course.credits, course.level, JSON.stringify(course.topics)));
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
