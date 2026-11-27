import assert from "node:assert/strict";
import test from "node:test";
import { gridHeight, gridWidth, readNccuTranscriptGrid } from "../lib/nccu-transcript-grid.ts";

function gridFixture() {
  const gray = new Uint8Array(gridWidth * gridHeight).fill(252);
  const paint = (x, y, width, height, value) => {
    for (let row = y; row < y + height; row++) gray.fill(value, row * gridWidth + x, row * gridWidth + x + width);
  };
  const rules = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
  for (const x of rules) paint(x, 168, 1, 433, 186);
  for (const y of [174, 207]) paint(39, y, 1152, 1, 180);
  for (let column = 0; column < 4; column++) {
    const upper = rules[column * 3 + 1];
    const lower = rules[column * 3 + 2];
    for (let line = 0; line < 4; line++) {
      const y = Math.round(216 - column * .8 + line * 14);
      paint(upper + 9, y - 4, 8, 9, 125);
      paint(lower + 9, y, 7, 1, 120);
      if (line === 1) paint(lower + 9, y - 4, 8, 9, 125);
    }
  }
  return gray;
}

test("recognizes the upright NCCU four-year form and distinguishes printed marks from dashes", () => {
  const page = gridFixture();
  const columns = readNccuTranscriptGrid(page);
  assert.equal(columns.length, 4);
  assert.deepEqual(columns[3].lines.map(({ upper, lower }) => [upper, lower]), [
    [true, false], [true, true], [true, false], [true, false], [false, false],
  ]);
  assert.equal(readNccuTranscriptGrid(page.reverse()), null);
  assert.equal(readNccuTranscriptGrid(new Uint8Array(gridWidth * gridHeight).fill(255)), null);
});

test("keeps the same year and semester grid after removing the personal-information header and margins", () => {
  const page = gridFixture();
  const left = 32;
  const top = 155;
  const scale = gridWidth / 1170;
  const height = Math.round(447 * scale);
  const cropped = new Uint8Array(gridWidth * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < gridWidth; x++) {
      cropped[y * gridWidth + x] = page[(top + Math.floor(y / scale)) * gridWidth + left + Math.floor(x / scale)];
    }
  }
  const columns = readNccuTranscriptGrid(cropped);
  assert.equal(columns?.length, 4);
  assert.ok(columns.every(({ headerTop }) => headerTop < 12));
  const semesters = (columns) => columns.map((column) => column.lines.map(({ upper, lower }) => [upper, lower]));
  assert.deepEqual(semesters(columns), semesters(readNccuTranscriptGrid(page)));
  assert.equal(readNccuTranscriptGrid(cropped.reverse()), null);
});
