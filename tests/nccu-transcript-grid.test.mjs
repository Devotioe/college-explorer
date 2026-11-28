import assert from "node:assert/strict";
import test from "node:test";
import { findNccuTranscriptColumns, gridHeight, gridWidth, readNccuTranscriptGrid, transcriptBrightnessCurve, transcriptInkContrast } from "../lib/nccu-transcript-grid.ts";

function gridFixture(pitch = 14, rowCount = 4, hasLower = (line) => line === 1) {
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
    for (let line = 0; line < rowCount; line++) {
      const y = Math.round(216 - column * .8 + line * pitch);
      paint(upper + 9, y - 4, 8, 9, 125);
      paint(lower + 9, y, 7, 1, 120);
      if (hasLower(line)) paint(lower + 9, y - 4, 8, 9, 125);
    }
  }
  return gray;
}

test("brightens gray paper, increases ink contrast and keeps different ink shades", () => {
  const gray = Uint8Array.from([...Array(8).fill(42), ...Array(12).fill(95), ...Array(70).fill(153), ...Array(10).fill(212)]);
  const curve = transcriptBrightnessCurve(gray);
  assert.ok(curve);
  assert.equal(curve[153], 238);
  assert.ok(curve[153] - curve[95] > 153 - 95);
  assert.ok(curve[42] < curve[95] && curve[212] > curve[153]);
  assert.equal(curve[255], 255);
  assert.ok(curve.every((value, index) => !index || value >= curve[index - 1]));
});

test("leaves normal white scans and uniformly blank pages alone", () => {
  assert.equal(transcriptBrightnessCurve(gridFixture()), null);
  assert.equal(transcriptBrightnessCurve(new Uint8Array(100).fill(175)), null);
});

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

test("uses the printed row spacing when the same form is stretched vertically", () => {
  const hasLower = (line) => line % 3 === 1;
  const expected = Array.from({ length: 12 }, (_, line) => [true, hasLower(line)]);
  for (const pitch of [13.2, 14.4, 14.8, 15.2]) {
    const columns = readNccuTranscriptGrid(gridFixture(pitch, expected.length, hasLower));
    assert.equal(columns?.length, 4, `pitch ${pitch}`);
    assert.ok(Math.abs(columns[0].rowHeight - pitch) < .3, `pitch ${pitch}`);
    for (const { lines } of columns) {
      assert.deepEqual(lines.slice(0, expected.length).map(({ upper, lower }) => [upper, lower]), expected, `pitch ${pitch}`);
    }
  }
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

test("uses the original year columns on gray scans with bright watermarks and a footer", () => {
  const fixture = gridFixture();
  const gray = fixture.map((pixel, index) => {
    if (pixel !== 252) return 75;
    const x = index % gridWidth;
    const y = Math.floor(index / gridWidth);
    return (x + y * 3) % 97 < 12 ? 241 : 170;
  });
  for (const y of [449, 450, 520]) gray.fill(65, y * gridWidth + 39, y * gridWidth + 1191);

  const ink = transcriptInkContrast(gray, gridWidth);
  assert.equal(ink[0], 0);
  assert.ok(ink[207 * gridWidth + 120] > 80);
  const { cleaned, columns } = findNccuTranscriptColumns(gray);
  assert.equal(cleaned, true);
  assert.equal(columns?.length, 4);
  assert.ok(columns.every(({ bodyBottom }) => bodyBottom >= 446 && bodyBottom <= 450));
  assert.ok(columns.every(({ lines }) => lines.length === 0));
});
