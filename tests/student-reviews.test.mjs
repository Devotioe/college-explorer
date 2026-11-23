import assert from "node:assert/strict";
import test from "node:test";
import published from "../data/dcard/processed/published.json" with { type: "json" };
import { indexPublishedReviews, indexTeacherReviews, reviewsForCourse } from "../lib/student-reviews.ts";

const valid = {
  id: "a897", courseId: "nccu-405001001", teacher: "孫秀蕙", semester: "114-1", postId: "260648836",
  course: "傳播概論",
  url: "https://www.dcard.tw/f/nccu/p/260648836", summary: "作者提到老師用新聞案例解說傳播概念。",
  sourceEvidence: "article", verificationStatus: "published", reason: "internal",
};

test("only sends public fields for reviewed NCCU entries", () => {
  const rows = indexPublishedReviews([
    valid,
    { ...valid, id: "quarantine", verificationStatus: "quarantine" },
    { ...valid, id: "other-school", courseId: "nthu-123" },
    { ...valid, id: "other-board", url: valid.url.replace("/nccu/", "/nthu/") },
    { ...valid, id: "wrong-post", postId: "100" },
    { ...valid, id: "no-summary", summary: "" },
  ]).get(valid.courseId);
  assert.deepEqual(rows, [{
    id: valid.id, teacher: valid.teacher, semester: valid.semester,
    sourceUrl: valid.url, summary: valid.summary, sourceEvidence: "article",
  }]);
});

test("groups each teacher's sources for the selected course even when the same post reviews another course", () => {
  const details = { teaching: "課堂用時事切入傳播理論。", assessment: "期中以小組提案評量。" };
  const otherCourse = {
    ...valid, id: "cross-listed", courseId: "nccu-405002001", course: "媒體與社會", teacher: "孫秀蕙、李小文",
  };
  const anotherPost = {
    ...valid, id: "another-post", postId: "260648800", url: "https://www.dcard.tw/f/nccu/p/260648800", semester: "113-1",
  };
  const groups = indexTeacherReviews([{ ...valid, details }, otherCourse, anotherPost]).get(valid.courseId);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].teacher, "孫秀蕙");
  assert.equal(groups[0].posts.length, 2);
  assert.equal(groups[0].posts[0].sourceUrl, valid.url);
  assert.deepEqual(groups[0].posts[0].entries.map((entry) => [entry.course, entry.isCurrentCourse]), [
    ["傳播概論", true],
  ]);
  assert.deepEqual(groups[0].posts[0].entries[0].details, details);
  assert.equal(groups[0].posts[1].entries[0].semester, "113-1");
});

test("a reviewed instructor does not populate an unrelated course's review section", () => {
  const groups = indexTeacherReviews([valid]).get("nccu-unknown");
  assert.deepEqual(groups, []);
});

test("keeps one entry for overlapping records from the same source, course and teacher", () => {
  const usingArchivedTerm = {
    ...valid, id: "archived", semester: "114-1", sourceEvidence: "archived_summary",
  };
  const fullArticle = {
    ...valid, id: "article", semester: "", teacher: "孫秀蕙、李小文",
    details: { assessment: "兩次考試及期末專案。" },
  };
  const entries = indexTeacherReviews([usingArchivedTerm, fullArticle])
    .get(valid.courseId).find((group) => group.teacher === valid.teacher).posts[0].entries;
  assert.deepEqual(entries.map((entry) => [entry.id, entry.semester]), [["article", "114-1"]]);

  const twoTerms = indexTeacherReviews([usingArchivedTerm, { ...fullArticle, semester: "113-1" }])
    .get(valid.courseId).find((group) => group.teacher === valid.teacher).posts[0].entries;
  assert.deepEqual(twoTerms.map((entry) => entry.semester), ["114-1", "113-1"]);
});

test("the bundled reviews are retrievable by course and courses without entries are empty", () => {
  assert.ok(published.length > 0);
  const courseIds = new Set(published.map((row) => row.courseId));
  assert.equal([...courseIds].reduce((total, id) => total + reviewsForCourse(id).length, 0), published.length);
  assert.deepEqual(reviewsForCourse("nccu-no-reviews"), []);
});
