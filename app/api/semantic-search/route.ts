import { NextResponse } from "next/server";
import seed from "../../../data/course-seed.json";
import { indexRecommendationCourses, recommendCourses } from "../../../lib/course-recommendations";
import { getNccuOfferingCourseIds } from "../../../lib/nccu-offerings";

let index: ReturnType<typeof buildIndex> | undefined;

function buildIndex() {
  return indexRecommendationCourses(seed.records.map(({ course, offerings }) => ({
    ...course,
    language: offerings[0]?.language?.includes("英") ? "英文" : "中文",
  })));
}

export async function POST(request: Request) {
  const value = await request.json().catch(() => null);
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 200) {
    return NextResponse.json({ error: "請輸入 1 至 200 字的課名、課號或學習需求。" }, { status: 400 });
  }
  index ??= buildIndex();
  const school = body.school === "NCCU" || body.school === "NTHU" ? body.school : undefined;
  const level = body.level === "大學部" || body.level === "研究所" ? body.level : undefined;
  const language = body.language === "中文" || body.language === "英文" ? body.language : undefined;
  const candidates = index.filter(({ course }) => (!school || course.school === school)
    && (!level || course.level === level) && (!language || course.language === language));
  const results = recommendCourses(query, candidates, getNccuOfferingCourseIds(query));
  return NextResponse.json({ query, total: results.length, results: results.slice(0, 120) });
}
