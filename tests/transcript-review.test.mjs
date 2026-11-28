import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTranscriptTitleCorrections, assignTranscriptSemester, confirmedTranscriptRows, editSemesterGrade, groupTranscriptForReview, normalizeTranscriptTerm,
  resolveOcrTranscriptPeriod, resolveTranscriptYearHeader, consolidateTranscriptSummaries, normalizeTranscriptSummaryValue,
  transcriptCreditCheck, transcriptRowsFromYearLine,
} from "../lib/transcript-review.ts";

function grade(id, term, gradeRaw, overrides = {}) {
  return { id, courseName: "計算機概論", courseCode: "306005001", term, gradeRaw, credits: 2, confidence: .94, ...overrides };
}

test("fills the catalog title before review and retains the OCR text and original semester and marks", () => {
  const courseName = "國際經済學";
  const sourceLine = "printed-line";
  const rows = [grade("fall", "113-1", "89.00", { courseName, sourceLine }), grade("spring", "113-2", "94.50", { courseName, sourceLine })];
  const candidate = { title: "國際經濟學", code: "catalog", confidence: .8, department: "經濟系", credits: 3 };
  const corrections = rows.map(({ id }) => ({ id, courseName: candidate.title, ocrCourseName: courseName, candidate }));
  const [review] = groupTranscriptForReview(applyTranscriptTitleCorrections(rows, corrections));
  assert.equal(review.courseName, candidate.title);
  assert.equal(review.ocrCourseName, courseName);
  assert.equal(review.requiresTitleReview, true);
  assert.deepEqual(confirmedTranscriptRows([review]).rows.map(({ term, gradeRaw, credits, courseCode }) => [term, gradeRaw, credits, courseCode]), [
    ["113-1", "89.00", 2, "306005001"], ["113-2", "94.50", 2, "306005001"],
  ]);
});

test("keeps printed decimals and leaves conflicting semester totals unresolved", () => {
  assert.equal(normalizeTranscriptSummaryValue(" ８６.２４０ "), "86.240");
  assert.equal(normalizeTranscriptSummaryValue("—"), null);
  const summary = { term: "113-1", average: "86.240", attemptedCredits: "3.0", earnedCredits: "3.00", cumulativeCredits: "20.5" };
  assert.deepEqual(consolidateTranscriptSummaries([summary, { ...summary, average: "86.24", cumulativeCredits: "21.5" }]),
    [{ ...summary, cumulativeCredits: null }]);
});

test("checks attempted credits against editable course rows in the same semester", () => {
  const summary = { term: "113-1", average: null, attemptedCredits: "3.5", earnedCredits: null, cumulativeCredits: null };
  const rows = groupTranscriptForReview([
    grade("fall", "113-1", "88.00"), grade("spring", "113-2", "92.00"), grade("other", "112-1", "90"),
  ]);
  assert.deepEqual(transcriptCreditCheck(rows, summary), { listed: 2, matches: false });
  assert.deepEqual(transcriptCreditCheck([editSemesterGrade(rows[0], "1", { credits: 3.5 })], summary), { listed: 3.5, matches: true });
  assert.equal(transcriptCreditCheck([editSemesterGrade(rows[0], "1", { credits: null })], summary), null);
});

test("a shared course line keeps both semesters in the academic year printed in the heading", () => {
  const year = resolveTranscriptYearHeader({ academicYear: "111", beginningYear: "111", endingYear: "112" });
  const rows = transcriptRowsFromYearLine({
    year, earliestYear: "", courseName: "普通心理學",
    upper: { credits: 3, grade: "93.00" }, lower: { credits: 3, grade: "79.00" },
  });
  assert.deepEqual(rows.map(({ term, credits, gradeRaw }) => [term, credits, gradeRaw]),
    [["111-1", 3, "93.00"], ["111-2", 3, "79.00"]]);
  assert.equal(rows[0].sourceLine, rows[1].sourceLine);
  const review = groupTranscriptForReview(rows);
  assert.equal(review.length, 1);
  assert.equal(review[0].year, "111");
  assert.equal(review[0].semesters["2"].gradeRaw, "79.00");
});

test("a blank semester stays empty and W or IP stays in its printed semester", () => {
  const base = { year: "114", earliestYear: "", courseName: "體育" };
  const spring = transcriptRowsFromYearLine({
    ...base, upper: { grade: "－－", present: true }, lower: { credits: 1, grade: "IP" },
  });
  const autumn = transcriptRowsFromYearLine({
    ...base, upper: { credits: 1, grade: "W" }, lower: {},
  });
  assert.deepEqual([...spring, ...autumn].map(({ term, gradeRaw }) => [term, gradeRaw]),
    [["114-2", "IP"], ["114-1", "W"]]);
  assert.equal(groupTranscriptForReview([...spring, ...autumn]).length, 2);
});

test("an unclear or conflicting year header leaves the known semester for review", () => {
  for (const academicYear of ["112", ""]) {
    const year = resolveTranscriptYearHeader({ academicYear, beginningYear: "111", endingYear: "112" });
    const rows = transcriptRowsFromYearLine({
      year, earliestYear: "", courseName: "普通心理學", upper: {}, lower: { credits: 3, grade: "79.00" },
    });
    assert.equal(rows[0].term, "");
    assert.equal(rows[0].recognizedSemester, "2");
  }
  assert.equal(resolveTranscriptYearHeader({ academicYear: "113", beginningYear: "", endingYear: "" }), "113");
});

test("keeps unreadable courses as separate rows and requires a title before saving", () => {
  const review = groupTranscriptForReview([
    grade("unreadable-fall", "110-1", "88", { courseName: "", courseCode: "" }),
    grade("unreadable-spring", "110-2", "", { courseName: "", courseCode: "" }),
  ]);
  assert.equal(review.length, 2);
  assert.equal(review[0].semesters["1"].gradeRaw, "88");
  assert.equal(review[1].semesters["2"].credits, 2);
  assert.match(confirmedTranscriptRows(review).error, /第 1 列課名待核對/u);
  review[0].courseName = "資料結構";
  assert.match(confirmedTranscriptRows(review).error, /第 2 列課名待核對/u);
  assert.equal(confirmedTranscriptRows(review.slice(0, 1)).rows[0].courseName, "資料結構");
});

test("keeps both semesters on the same physical line even when its year and title are unreadable", () => {
  const review = groupTranscriptForReview([
    grade("line-1-1", "", "", { sourceLine: "line-1", recognizedSemester: "1", courseName: "", credits: null, courseCode: "", requiresOcrReview: true }),
    grade("line-1-2", "", "89", { sourceLine: "line-1", recognizedSemester: "2", courseName: "", courseCode: "" }),
    grade("line-2-1", "", "82", { sourceLine: "line-2", recognizedSemester: "1", courseName: "", courseCode: "" }),
  ]);
  assert.equal(review.length, 2);
  assert.equal(review[0].semesters["2"].gradeRaw, "89");
  assert.equal(review[1].semesters["1"].gradeRaw, "82");
  assert.match(confirmedTranscriptRows(review).error, /第 1 列課名待核對/u);
});

test("shows a course with no printed grades without making up a semester", () => {
  const review = groupTranscriptForReview([
    grade("ungraded", "110", "", { courseName: "服務學習", credits: null, ungraded: true }),
    grade("graded", "110-1", "89"),
  ]);
  assert.equal(review[0].year, "110");
  assert.equal(review[0].unassigned, undefined);
  assert.deepEqual(confirmedTranscriptRows(review).rows.map(({ id }) => id), ["graded"]);
});

test("pairs upper and lower semester scores without merging different years or course families", () => {
  const grades = [
    grade("fall", "114學年度第1學期", "86.5"),
    grade("spring", "１１４－２", "91", { courseCode: "306005011" }),
    grade("earlier", "113-2", "B"),
    grade("different", "114-2", "93", { courseCode: "703820001" }),
  ];
  const review = groupTranscriptForReview(grades);
  assert.equal(review.length, 3);
  assert.equal(review[0].semesters["1"].gradeRaw, "86.5");
  assert.equal(review[0].semesters["2"].gradeRaw, "91");
  assert.deepEqual(confirmedTranscriptRows(review).rows.map(({ term, gradeRaw, courseCode }) => [term, gradeRaw, courseCode]), [
    ["114-1", "86.5", "306005001"], ["114-2", "91", "306005011"], ["113-2", "B", "306005001"], ["114-2", "93", "703820001"],
  ]);
});

test("requires a user to assign an uncertain term before saving its grade", () => {
  const [row] = groupTranscriptForReview([grade("unknown", "114", "0")]);
  assert.equal(row.year, "114");
  assert.match(confirmedTranscriptRows([row]).error, /指定成績屬於哪個學期/);
  const confirmed = confirmedTranscriptRows([assignTranscriptSemester(row, "2")]).rows[0];
  assert.equal(confirmed.term, "114-2");
  assert.equal(confirmed.gradeRaw, "0");
});

test("pairs a missing course code with an unambiguous counterpart and leaves that code editable", () => {
  const review = groupTranscriptForReview([
    grade("fall", "114-1", "92", { courseCode: "" }),
    grade("spring", "114-2", "95"),
  ]);
  assert.equal(review.length, 1);
  assert.equal(review[0].semesters["1"].courseCode, "");
  assert.equal(review[0].semesters["2"].courseCode, "306005001");
});

test("saves edited grades, skips empty semesters and leaves an original summer grade intact", () => {
  const [row] = groupTranscriptForReview([grade("fall", "2025-1", "70"), grade("summer", "114學年度暑修", "P")]);
  const edited = editSemesterGrade(editSemesterGrade(row, "1", { gradeRaw: "95" }), "2", { gradeRaw: "" });
  assert.deepEqual(confirmedTranscriptRows([edited]).rows.map(({ term, gradeRaw }) => [term, gradeRaw]), [["114-1", "95"], ["114-3", "P"]]);
  assert.equal(normalizeTranscriptTerm("113學年度下學期"), "113-2");
});

test("keeps OCR academic years anchored to the heading and checks the earliest year", () => {
  assert.deepEqual(resolveOcrTranscriptPeriod("１１０學年度", "第 1 學期", "110"), { term: "110-1" });
  assert.deepEqual(resolveOcrTranscriptPeriod("西元2021年", "下學期", "110"), { term: "110-2" });
  assert.deepEqual(resolveOcrTranscriptPeriod("80", "上學期", ""), { term: "80-1" });
  assert.deepEqual(resolveOcrTranscriptPeriod("80", "上學期", "110"), { term: "", recognizedSemester: "1" });
  assert.deepEqual(resolveOcrTranscriptPeriod("成績：80", "暑修", ""), { term: "", recognizedSemester: "3" });
  assert.deepEqual(resolveOcrTranscriptPeriod("110", "", "110"), { term: "110" });
});

test("leaves an uncertain OCR year editable and preserves grades in their identified semesters", () => {
  const [first, second] = groupTranscriptForReview([
    grade("unknown-fall", "", "80", { recognizedSemester: "1" }),
    grade("unknown-spring", "", "87", { recognizedSemester: "2" }),
  ]);
  assert.equal(first.year, "");
  assert.equal(first.semesters["1"].gradeRaw, "80");
  assert.equal(second.semesters["2"].gradeRaw, "87");
  assert.match(confirmedTranscriptRows([first]).error, /有效學年度/);
  const { rows } = confirmedTranscriptRows([{ ...first, year: "110" }]);
  assert.equal(rows[0].term, "110-1");
  assert.equal(rows[0].gradeRaw, "80");
});
