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
