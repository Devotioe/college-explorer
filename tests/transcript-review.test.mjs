import assert from "node:assert/strict";
import test from "node:test";
import {
  assignTranscriptSemester, confirmedTranscriptRows, editSemesterGrade, groupTranscriptForReview, normalizeTranscriptTerm,
  resolveOcrTranscriptPeriod,
} from "../lib/transcript-review.ts";

function grade(id, term, gradeRaw, overrides = {}) {
  return { id, courseName: "計算機概論", courseCode: "306005001", term, gradeRaw, credits: 2, confidence: .94, ...overrides };
}

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
