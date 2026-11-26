import assert from "node:assert/strict";
import test from "node:test";
import { preferTranscriptScanRetry, transcriptScanCrops } from "../lib/transcript-scan-layout.ts";

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
