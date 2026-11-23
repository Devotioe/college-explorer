import assert from "node:assert/strict";
import test from "node:test";
import { getCourseDetailText, getReviewedCourseHighlights } from "../lib/course-detail-text.ts";

test("restores the complete NCCU text for a locally bootstrapped course", () => {
  const text = getCourseDetailText("nccu-306049001", {
    description: "First programming course for MIS majors, designed for students with little or no programming experience.",
    objectives: "",
  });
  assert.ok(text.description.length > 600);
  assert.match(text.description, /Java/i);
  assert.match(text.objectives, /Eclipse IDE/);
  assert.match(text.objectives, /JavaDoc/);
});

test("preserves independently updated database text and handles absent fields", () => {
  assert.deepEqual(getCourseDetailText("nccu-306049001", {
    description: "教師補充了本學期的新內容。",
    objectives: "能測試並解釋自己的程式。",
  }), { description: "教師補充了本學期的新內容。", objectives: "能測試並解釋自己的程式。" });
  assert.deepEqual(getCourseDetailText("nthu-missing", { description: null, objectives: null }), {
    description: "", objectives: "",
  });
});

test("uses reviewed highlights only when the available source still matches the reviewed text", () => {
  const id = "nccu-306049001";
  const source = getCourseDetailText(id, {});
  const highlights = getReviewedCourseHighlights(id, source);
  assert.equal(highlights.descriptionPoints.length, 3);
  assert.match(highlights.objectivePoints.join(" "), /JavaDoc/);
  assert.equal(getReviewedCourseHighlights(id, { ...source, objectives: "本學期已更換教材。" }), undefined);
});
