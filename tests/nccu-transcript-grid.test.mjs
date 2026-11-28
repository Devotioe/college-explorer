import assert from "node:assert/strict";
import test from "node:test";
import { assembleTranscriptGridCells, findNccuTranscriptColumns, gridHeight, gridWidth, readNccuTranscriptGrid, transcriptBrightnessCurve, transcriptGridBatches, transcriptGridFields, transcriptGridSummaryBounds, transcriptInkContrast } from "../lib/nccu-transcript-grid.ts";

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

test("preserves physical row numbers and shows wrapped title context at a batch seam", () => {
  const lines = Array.from({ length: 17 }, (_, index) => ({
    line: index + 1, center: 210 + index * 14, upper: index !== 7, lower: false,
  }));
  const batches = transcriptGridBatches(lines);
  assert.deepEqual(batches.map(({ lines }) => lines.length), [7, 7, 3]);
  assert.deepEqual(batches.flatMap((batch) => batch.lines), lines);
  assert.equal(batches[0].continuation?.line, 8);
  assert.equal(batches[1].continuation, undefined);
  assert.deepEqual(transcriptGridBatches(batches[0].lines, 3).map((batch) => batch.lines.map(({ line }) => line)),
    [[1, 2, 3], [4, 5, 6], [7]]);
});

test("includes rows below the form divider even if the scan's divider cannot be located", () => {
  const [column] = readNccuTranscriptGrid(gridFixture());
  for (const bodyBottom of [gridHeight, 601]) {
    const bounds = transcriptGridSummaryBounds({ ...column, bodyBottom }, gridHeight);
    assert.ok(bounds.top * gridHeight / 1000 < 601);
    assert.ok(bounds.bottom * gridHeight / 1000 > 670);
    assert.ok(bounds.right < 300);
  }
});

test("reads names and each semester from adjacent, non-overlapping physical columns", () => {
  const [column] = readNccuTranscriptGrid(gridFixture());
  assert.deepEqual(transcriptGridFields(column), [
    { field: "titles", left: 39, right: 195 },
    { field: "upper", left: 195, right: 262 },
    { field: "lower", left: 262, right: 329 },
  ]);
});

test("binds a score to its printed cell id even when the model reorders readings", () => {
  const rows = assembleTranscriptGridCells([
    { line: 8, upper: true, lower: false },
    { line: 9, upper: true, lower: true },
  ], [{ line: 8, courseName: "統計學（一）" }, { line: 9, courseName: "統計學（二）" }], [
    { id: 209, credits: 3, grade: "95.00" },
    { id: 208, credits: 3, grade: "89.00" },
    { id: 108, credits: 3, grade: "89.00" },
    { id: 109, credits: 3, grade: "77.50" },
    { id: 109, credits: 3, grade: "79.50" },
  ]);
  assert.deepEqual(rows, [
    { line: 8, courseName: "統計學（一）", upperCredits: 3, upperGrade: "89.00", lowerCredits: null, lowerGrade: null },
    { line: 9, courseName: "統計學（二）", upperCredits: null, upperGrade: null, lowerCredits: 3, lowerGrade: "95.00" },
  ]);
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

test("recovers faint marks and independently calibrated rows in the rightmost years", () => {
  const gray = gridFixture(14, 0);
  const rules = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
  const years = [
    { first: 216, pitch: 14, ink: 126, delta: 0 },
    { first: 216, pitch: 14, ink: 126, delta: 0 },
    { first: 217, pitch: 14.7, ink: 222, delta: 2 },
    { first: 215, pitch: 13.2, ink: 226, delta: -3 },
  ];
  for (const [index, { first, pitch, ink, delta }] of years.entries()) {
    const lower = rules[index * 3 + 2];
    const right = rules[index * 3 + 3];
    if (delta) {
      gray.fill(252, 207 * gridWidth + lower + 1, 207 * gridWidth + right);
      gray.fill(180, (207 + delta) * gridWidth + lower + 1, (207 + delta) * gridWidth + right);
    }
    for (let row = 0; row < 12; row++) {
      const center = Math.round(first + row * pitch);
      for (const [left, y, active] of [[rules[index * 3 + 1], center, row % 3 !== 2], [lower, center + delta, row % 3 !== 0]]) {
        for (let dy = active ? -4 : 0; dy <= (active ? 4 : 0); dy++) {
          const start = (y + dy) * gridWidth + left + 18;
          gray.fill(ink, start, start + 9);
          gray.fill(ink, start + 25, start + 33);
        }
      }
    }
  }
  for (let y = 485; y < 493; y++) gray.fill(180, y * gridWidth + 1058, y * gridWidth + 1190);
  for (let y = 483; y < 492; y++) gray.fill(226, y * gridWidth + 847, y * gridWidth + 857);
  const columns = readNccuTranscriptGrid(gray);
  assert.equal(columns?.length, 4);
  const expected = Array.from({ length: 12 }, (_, row) => [row % 3 !== 2, row % 3 !== 0]);
  for (const [index, column] of columns.entries()) {
    const { pitch, delta } = years[index];
    assert.ok(Math.abs(column.rowHeight - pitch) <= .25, `year ${index + 1} pitch`);
    assert.deepEqual(column.lines.slice(0, 12).map(({ upper, lower }) => [upper, lower]), expected, `year ${index + 1} marks`);
    assert.equal(column.lines.length, 13);
    assert.equal(column.lines[0].lowerCenter - column.lines[0].upperCenter, delta);
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

test("locates both semester marks by row on gray scans with bright watermarks and a footer", () => {
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
  const semesterMarks = (pageColumns) => pageColumns.map(({ lines }) => lines.map(({ upper, lower }) => [upper, lower]));
  assert.deepEqual(semesterMarks(columns), semesterMarks(readNccuTranscriptGrid(fixture)));
});
