import assert from "node:assert/strict";
import test from "node:test";
import { indexRecommendationCourses, recommendCourses } from "../lib/course-recommendations.ts";

function course(id, titleZh, properties = {}) {
  return { id, titleZh, code: "703049001", titleEn: "", department: "", topics: [], school: "NCCU", ...properties };
}

test("a natural-language app query retrieves direct and foundational courses with syllabus evidence", () => {
  const index = indexRecommendationCourses([
    course("programming", "程式設計一", { objectives: "參考資料。".repeat(140) + "以 programming 實作命令列專案。" }),
    course("app", "行動應用開發", { description: "設計手機應用介面與實作原型。", syllabusUrl: "https://example.edu/syllabus" }),
    course("other", "電影敘事"),
  ]);
  const results = recommendCourses("我想學做手機 APP", index);
  assert.deepEqual(results.map(({ id }) => id), ["app", "programming"]);
  assert.equal(results[0].syllabusUrl, "https://example.edu/syllabus");
  assert.ok(results[1].evidence.some(({ topic, related }) => topic === "行動應用開發" && related));
  assert.ok(results[1].evidence.some(({ source, excerpt }) => source === "課程目標／大綱" && excerpt.includes("命令列專案")));
});

test("an ASCII alias cannot match an unrelated substring and exact section codes keep their course", () => {
  const index = indexRecommendationCourses([
    course("taiwan", "臺灣歷史", { titleEn: "Taiwan History", code: "999999001" }),
    course("ai", "人工智慧"),
  ]);
  assert.deepEqual(recommendCourses("AI", index).map(({ id }) => id), ["ai"]);
  assert.deepEqual(recommendCourses("703049-011", index, ["ai"]).map(({ id }) => id), ["ai"]);
});
