import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogIndex, canonicalizeDcardUrl, classifyReview, processReviews } from "../scripts/process-dcard-reviews.mjs";

const url = "https://www.dcard.tw/f/nccu/p/260648836";
const titles = ["統計學（一）", "統計學（一）"];
const index = buildCatalogIndex(titles.map((titleZh, i) => ({
  course: { id: `nccu-${i}`, code: String(i), school: "NCCU", titleZh, department: i ? "經濟系" : "統計系", offeredTerms: ["114-1"] },
  offerings: [{ teacher: i ? "王小文、林小文" : "王小文" }],
})));
const review = {
  url, postId: "260648836", course: "統計學(一)", teacher: "王小文", semester: "114–1",
  summary: "作者提到老師每週提供練習，期末以小組報告評量。", sourceEvidence: "article", sourceTitle: "課程心得",
};

test("folds comment links to the NCCU parent and rejects lookalike or other boards", () => {
  assert.deepEqual(canonicalizeDcardUrl(`${url}/b/4?foo=bar`), { url, postId: "260648836" });
  for (const invalid of [url.replace("nccu", "nthu"), url.replace("www.dcard.tw", "www.dcard.tw.example.org"), url.replace("www.", "bad@www."), `${url}/foo`]) {
    assert.equal(canonicalizeDcardUrl(invalid), null);
  }
});

test("requires evidence for a single teacher-course match", () => {
  assert.equal(classifyReview(review, index).reason, "ambiguous_course");
  assert.equal(classifyReview({ ...review, department: "統計系" }, index).courseId, "nccu-0");
  assert.equal(classifyReview({ ...review, courseCode: "1", teacher: "林小文" }, index).verificationStatus, "published");
  assert.equal(classifyReview({ ...review, courseCode: "0", teacher: "林小文" }, index).reason, "teacher_not_verified");
  assert.equal(classifyReview({ ...review, courseCode: "0", semester: "100-2" }, index).reason, "semester_not_verified");
  assert.equal(classifyReview({ ...review, courseCode: "0", semester: "113" }, index).reason, "invalid_semester");
  assert.equal(classifyReview({ ...review, courseCode: "0", teacher: "" }, index).reason, "teacher_missing");
  assert.equal(classifyReview({ ...review, courseCode: "0", sourceEvidence: "candidate" }, index).reason, "insufficient_content");
  assert.equal(classifyReview({ ...review, url: `${url}/b/4` }, index, new Set([url])).reason, "withdrawn_source");
  assert.equal(classifyReview({ ...review, postId: "9999" }, index).reason, "post_id_mismatch");
});

test("deduplicates the same teacher, course and post, preferring the article", () => {
  const legacy = { ...review, courseCode: "1", teacher: "林小文、王小文", semester: "", sourceEvidence: "archived_summary", archiveSourceVerified: true };
  const article = { ...review, courseCode: "1", teacher: "王小文、林小文", semester: "" };
  const result = processReviews([legacy, article], index);
  assert.equal(result.published.length, 1);
  assert.equal(result.published[0].sourceEvidence, "article");
  assert.equal(result.published[0].semester, "");
  assert.equal(result.rejected[0].reason, "duplicate_post_review");
});

test("keeps an explicit conflicting department out of publication", () => {
  assert.equal(classifyReview({ ...review, courseCode: "0", department: "法律系" }, index).reason, "department_mismatch");
});

test("requires an actual archive source and semester-specific roster for legacy summaries", () => {
  const legacy = { ...review, courseCode: "0", sourceEvidence: "archived_summary" };
  assert.equal(classifyReview(legacy, index).reason, "source_not_verified");
  assert.equal(classifyReview({ ...legacy, archiveSourceVerified: true }, index).reason, "teacher_term_not_verified");
  assert.equal(classifyReview({ ...review, courseCode: "0", sourceTitle: "" }, index).reason, "source_not_verified");
});

test("preserves sourced details on published rows and keeps them out of unverified output", () => {
  const details = {
    teaching: "教師以範例說明各種統計方法。",
    workload: "  每週練習一組題目，期末報告需要分組完成。 ",
    assessment: "",
    privateNote: "internal",
  };
  const input = { ...review, courseCode: "0", details };
  assert.deepEqual(classifyReview(input, index).details, {
    teaching: details.teaching,
    workload: details.workload.trim(),
  });
  assert.equal(classifyReview({ ...input, teacher: "林小文" }, index).details, undefined);
});
