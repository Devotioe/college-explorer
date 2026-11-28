import assert from "node:assert/strict";
import test from "node:test";
import { completeTranscriptRowCount, hasIncompleteGridReading, isTranscriptGradeDash, isTranscriptPageText, keepReadableTranscriptGridLines, preferTranscriptScanRetry, reconcileNumberedTranscriptGrades, reconcileNumberedTranscriptTitles, reconcileTranscriptScanRetry, transcriptScanCrops } from "../lib/transcript-scan-layout.ts";

const left = { left: 55, right: 255, top: 210, bottom: 681, expectedRows: 14 };
const middle = { left: 250, right: 483, top: 220, bottom: 711, expectedRows: 12 };
const right = { left: 492, right: 735, top: 215, bottom: 687, expectedRows: null };
const fourth = { left: 740, right: 970, top: 216, bottom: 683, expectedRows: 15 };

test("crops a four-column transcript in order, with no repeated image area at the seams", () => {
  const crops = transcriptScanCrops([middle, fourth, right, left]);
  assert.equal(crops.length, 4);
  assert.deepEqual(crops.map(({ expectedRows }) => expectedRows), [14, 12, null, 15]);
  assert.equal(crops[0].left, 31);
  assert.equal(crops[0].top, 182);
  assert.equal(crops[3].right, 994);
  crops.slice(1).forEach((crop, index) => assert.equal(crops[index].right, crop.left));
});

test("falls back to the full page when the table boundaries are unusable", () => {
  const fallback = [{ left: 0, top: 0, right: 1000, bottom: 1000, expectedRows: null }];
  assert.deepEqual(transcriptScanCrops([]), fallback);
  assert.deepEqual(transcriptScanCrops([left, { ...middle, left: 120 }]), fallback);
  assert.deepEqual(transcriptScanCrops([{ ...left, right: 90 }]), fallback);
});

test("a second pass fills gaps without replacing recognised semester grades", () => {
  const original = { id: "first", term: "110-1", courseCode: "", courseName: "資料結構", credits: 3, gradeRaw: "88", confidence: .9 };
  const missing = { ...original, id: "new", courseName: "", gradeRaw: "92" };
  const reread = { ...original, id: "reread", courseName: "資料 結構", confidence: .8 };
  assert.equal(preferTranscriptScanRetry([original], [reread, missing]), true);
  assert.equal(preferTranscriptScanRetry([original], [{ ...reread, gradeRaw: "89" }, missing]), false);
  assert.equal(preferTranscriptScanRetry([original], [reread]), false);
});

test("keeps a conflicting grade for review and still fills another course's missing grade", () => {
  const fall = { id: "fall", sourceLine: "row-1", term: "110-1", courseCode: "", courseName: "資料結構", credits: 3, gradeRaw: "88.00", confidence: .85 };
  const spring = { ...fall, id: "spring", term: "110-2", gradeRaw: "", requiresOcrReview: true };
  const retry = [
    { ...fall, gradeRaw: "86" },
    { ...spring, courseName: "資料 結構", gradeRaw: "92" },
  ];
  const rows = reconcileTranscriptScanRetry([fall, spring], retry);
  assert.deepEqual(rows.map(({ id, sourceLine, gradeRaw, requiresOcrReview }) => [id, sourceLine, gradeRaw, requiresOcrReview]),
    [["fall", "row-1", "88.00", true], ["spring", "row-1", "92", undefined]]);
  assert.equal(reconcileTranscriptScanRetry([fall], [{ ...fall, gradeRaw: "88" }])[0].requiresOcrReview, undefined);
  assert.equal(hasIncompleteGridReading([fall], 2, 0), true);
});

test("does not copy scores into a different year or an ambiguous repeated course", () => {
  const row = { id: "a", term: "110-1", courseCode: "", courseName: "體育", credits: 1, gradeRaw: "", confidence: .85 };
  const complete = { ...row, id: "c", courseName: "統計學", credits: 3, gradeRaw: "89" };
  const later = { ...row, term: "111-1", gradeRaw: "92" };
  const secondSection = { ...row, id: "b" };
  assert.deepEqual(reconcileTranscriptScanRetry([row], [later]), [row]);
  assert.deepEqual(reconcileTranscriptScanRetry([row, secondSection, complete], [{ ...row, gradeRaw: "87" }]),
    [row, secondSection, complete]);
});

test("recovers a course title at its printed row without moving either semester's grades", () => {
  const fall = { id: "fall", sourceLine: "line-8", scanLine: 8, term: "112-1", courseCode: "", courseName: "",
    credits: 3, gradeRaw: "87.00", confidence: 0, requiresTitleReview: true, requiresOcrReview: true };
  const spring = { ...fall, id: "spring", term: "112-2", gradeRaw: "91.50" };
  const other = { ...fall, id: "next", scanLine: 9, sourceLine: "line-9" };
  const retry = [{ ...fall, courseName: "中文思辨與表達", gradeRaw: "87", requiresTitleReview: undefined }];
  const rows = reconcileNumberedTranscriptTitles([fall, spring, other], retry);
  assert.deepEqual(rows.map(({ term, courseName, gradeRaw, sourceLine }) => [term, courseName, gradeRaw, sourceLine]), [
    ["112-1", "中文思辨與表達", "87.00", "line-8"],
    ["112-2", "中文思辨與表達", "91.50", "line-8"],
    ["112-1", "", "87.00", "line-9"],
  ]);
  assert.deepEqual(reconcileNumberedTranscriptTitles([fall], [{ ...retry[0], gradeRaw: "81" }]), [fall]);
});

test("flags different readings of similar course titles for the same physical row", () => {
  const row = { id: "fall", scanLine: 8, term: "112-1", courseCode: "", courseName: "應用統計學（一）",
    credits: 3, gradeRaw: "89.00", confidence: .85 };
  const [unresolved] = reconcileNumberedTranscriptTitles([row], [{ ...row, courseName: "應用統計學（二）" }]);
  assert.deepEqual(unresolved, { ...row, requiresTitleReview: true });
  assert.deepEqual(reconcileNumberedTranscriptTitles([row], [{ ...row, courseName: "應用統計學(一)" }]), [row]);
});

test("only fills missing grades from a reread of the same physical semester cell", () => {
  const first = { id: "one", scanLine: 8, term: "113-1", courseCode: "", courseName: "統計學（一）",
    credits: 3, gradeRaw: "", confidence: 0, requiresOcrReview: true };
  const wrongSemester = { ...first, term: "113-2", gradeRaw: "89.00" };
  const wrongRow = { ...first, scanLine: 9, gradeRaw: "89.00" };
  assert.deepEqual(reconcileNumberedTranscriptGrades([first], [wrongSemester, wrongRow]), [first]);
  const [filled] = reconcileNumberedTranscriptGrades([first], [{ ...first, gradeRaw: "89.00" }]);
  assert.deepEqual([filled.term, filled.gradeRaw, filled.requiresOcrReview], ["113-1", "89.00", undefined]);
});

test("counts fully unreadable lines without fanning out empty review rows", () => {
  const empty = { id: "u-1", term: "110-1", sourceLine: "u", courseName: "", courseCode: "", credits: null, gradeRaw: "",
    confidence: 0, requiresOcrReview: true };
  const sameLine = { ...empty, id: "u-2", term: "110-2" };
  const known = { ...empty, id: "k-1", sourceLine: "k", courseName: "國際經濟學", credits: 3, gradeRaw: "60.00" };
  const knownSpring = { ...sameLine, id: "k-2", sourceLine: "k" };
  const partialCredit = { ...empty, id: "p-1", sourceLine: "p", credits: 2 };
  assert.deepEqual(keepReadableTranscriptGridLines([empty, sameLine, known, knownSpring, partialCredit]),
    { rows: [known, knownSpring, partialCredit], unreadableLines: 1 });
});

test("recognizes the school watermark and rejects grid readings consisting of watermark text and blanks", () => {
  const fragments = ["NATIONAL CHENGCHI UN", "NATIONAL CHENGCHI UNIVERS", "NATIONAL CHENGCHI UNIVERSITY", "國立政治大學"];
  assert.ok(fragments.every(isTranscriptPageText));
  assert.equal(isTranscriptPageText("National Chengchi University History"), false);
  assert.equal(isTranscriptPageText("國立政治大學校史研究"), false);

  const rows = fragments.map((courseName, id) => ({ id: String(id), courseName, gradeRaw: "", credits: null, courseCode: "", term: "", confidence: .85 }));
  const readable = { ...rows[0], courseName: "再保險", gradeRaw: "92" };
  assert.equal(completeTranscriptRowCount([...rows, readable]), 1);
  assert.equal(hasIncompleteGridReading([readable], 1, rows.length), true);
  assert.equal(hasIncompleteGridReading([...rows, readable], 4, 0), true);
  assert.equal(hasIncompleteGridReading([readable], 1, 0), false);
});

test("distinguishes printed empty score dashes from real grade marks", () => {
  assert.ok(["-", "－", "—", "－ －", "−"].every(isTranscriptGradeDash));
  assert.ok(["A-", "IP", "88.00", "抵免", ""].every((grade) => !isTranscriptGradeDash(grade)));
});
