import assert from "node:assert/strict";
import test from "node:test";
import { completeTranscriptRowCount, isTranscriptGradeDash, isTranscriptPageText, needsUncutTranscriptRetry, preferTranscriptScanRetry, transcriptScanCrops } from "../lib/transcript-scan-layout.ts";

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

test("recognizes the school watermark and rejects grid readings consisting of watermark text and blanks", () => {
  const fragments = ["NATIONAL CHENGCHI UN", "NATIONAL CHENGCHI UNIVERS", "NATIONAL CHENGCHI UNIVERSITY", "國立政治大學"];
  assert.ok(fragments.every(isTranscriptPageText));
  assert.equal(isTranscriptPageText("National Chengchi University History"), false);
  assert.equal(isTranscriptPageText("國立政治大學校史研究"), false);

  const rows = fragments.map((courseName, id) => ({ id: String(id), courseName, gradeRaw: "", credits: null, courseCode: "", term: "", confidence: .85 }));
  const readable = { ...rows[0], courseName: "再保險", gradeRaw: "92" };
  assert.equal(completeTranscriptRowCount([...rows, readable]), 1);
  assert.equal(needsUncutTranscriptRetry([readable], 1, rows.length), true);
  assert.equal(needsUncutTranscriptRetry([...rows, readable], 4, 0), true);
  assert.equal(needsUncutTranscriptRetry([readable], 1, 0), false);
});

test("distinguishes printed empty score dashes from real grade marks", () => {
  assert.ok(["-", "－", "—", "－ －", "−"].every(isTranscriptGradeDash));
  assert.ok(["A-", "IP", "88.00", "抵免", ""].every((grade) => !isTranscriptGradeDash(grade)));
});
