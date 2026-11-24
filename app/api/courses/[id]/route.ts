import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getCourseDetailText, getCoursePrerequisites, getReviewedCourseHighlights } from "../../../../lib/course-detail-text";
import { summarizeCourseText } from "../../../../lib/course-highlights";
import { getNccuOfferings } from "../../../../lib/nccu-offerings";
import { reviewsForCourse, teacherReviewsForCourse } from "../../../../lib/student-reviews";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  if (!env.DB) return NextResponse.json({ error: "D1 尚未連線" }, { status: 503 });
  const { id } = await context.params;
  const row = await env.DB.prepare(`
    SELECT c.id, c.school, c.code, c.title_zh AS titleZh, c.title_en AS titleEn,
      c.department, c.credits, c.level, c.topics, c.description, c.objectives,
      c.prerequisites, c.syllabus_url AS syllabusUrl, c.syllabus_source AS syllabusSource,
      c.offered_terms AS offeredTermsJson, c.requirement, o.semester, o.teacher,
      o.language, o.schedule, o.source
    FROM courses c
    LEFT JOIN course_offerings o ON o.id = (
      SELECT id FROM course_offerings x WHERE x.course_id = c.id ORDER BY x.semester DESC, x.id LIMIT 1
    )
    WHERE c.id = ?
  `).bind(id).first<Record<string, unknown>>();
  if (!row) return NextResponse.json({ error: "找不到課程" }, { status: 404 });
  let offeredTerms: string[] = [];
  try { offeredTerms = JSON.parse(String(row.offeredTermsJson || "[]")); } catch { offeredTerms = row.semester ? [String(row.semester)] : []; }
  const courseText = getCourseDetailText(id, row);
  const highlights = getReviewedCourseHighlights(id, courseText)
    ?? summarizeCourseText(courseText.description, courseText.objectives);
  return NextResponse.json({
    course: {
      ...row,
      ...courseText,
      ...highlights,
      prerequisites: getCoursePrerequisites(id, row.prerequisites),
      offeredTerms,
      offerings: getNccuOfferings(id),
      syllabusSource: row.syllabusSource || "",
      syllabusUrl: row.syllabusUrl || "",
      requirement: row.requirement || "",
      reviews: row.school === "NCCU" ? reviewsForCourse(id) : [],
      teacherReviews: row.school === "NCCU" ? teacherReviewsForCourse(id) : [],
    },
  });
}
