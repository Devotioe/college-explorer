export const gridWidth = 1237;
export const gridHeight = 878;

// Expected vertical rules of the four-year, two-semester NCCU transcript form.
const rulePositions = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
export const gridRowHeight = 14;

export type TranscriptGridSlot = { line: number; upper: boolean; lower: boolean };
type GridLine = TranscriptGridSlot & { center: number };
export type TranscriptGridColumn = {
  left: number; right: number; headerTop: number; headerHeight: number; rowHeight: number; lines: GridLine[];
};

export function readNccuTranscriptGrid(gray: Uint8Array): TranscriptGridColumn[] | null {
  const height = gray.length / gridWidth;
  if (!Number.isInteger(height) || height < 300 || height > 1050) return null;
  const at = (x: number, y: number) => gray[y * gridWidth + x];

  const vertical = new Int16Array(gridWidth);
  for (let x = 6; x < gridWidth - 6; x++) {
    for (let y = 0; y < height; y += 2) {
      if (Math.max(at(x - 6, y), at(x + 6, y)) - at(x, y) > 12) vertical[x]++;
    }
  }

  // Removing the margins can shift the measured rules or make them farther apart.
  let rules: number[] = [];
  let bestStrength = 0;
  for (let zoom = 1; zoom <= 1.101; zoom += .02) {
    for (let offset = -63; offset <= 7; offset += 7) {
      const positions = rulePositions.map((position) => {
        const predicted = Math.max(6, Math.min(gridWidth - 7, Math.round(position * zoom + offset)));
        let best = predicted;
        for (let x = Math.max(6, predicted - 8); x <= Math.min(gridWidth - 7, predicted + 8); x++) {
          if (vertical[x] > vertical[best]) best = x;
        }
        return best;
      });
      const strength = positions.reduce((sum, x) => sum + vertical[x], 0);
      if (strength > bestStrength) {
        bestStrength = strength;
        rules = positions;
      }
    }
  }
  const minimumRule = Math.min(130, height * .185);
  if (rules.filter((x) => vertical[x] >= minimumRule).length < 11) return null;
  const scale = (rules[11] - rules[1]) / (rulePositions[11] - rulePositions[1]);
  if (scale < .97 || scale > 1.13) return null;

  // The year/semester headings and the course rows have parallel rules about 33 px apart.
  // Find their position in the uploaded image instead of measuring from the page top.
  const horizontal = new Int16Array(height);
  for (let y = 4; y < height - 4; y++) {
    for (let x = rules[0]; x < rules[12]; x += 2) {
      if (Math.max(at(x, y - 4), at(x, y + 4)) - at(x, y) > 14) horizontal[y]++;
    }
  }
  const minimumHeader = (rules[12] - rules[0]) * .2;
  let headerEnd = 0;
  let bestHeader = 0;
  for (let y = Math.round(36 * scale); y < height - 100; y++) {
    if (horizontal[y] < minimumHeader) continue;
    const top = y - Math.round(33 * scale);
    const heading = Math.max(...horizontal.subarray(top - 2, top + 3));
    if (heading < minimumHeader) continue;
    const strength = horizontal[y] * 2 + heading;
    if (strength > bestHeader) {
      bestHeader = strength;
      headerEnd = y;
    }
  }
  if (!headerEnd) return null;
  const headerTop = Math.max(0, headerEnd - Math.round(47 * scale));
  const headerHeight = headerEnd - headerTop + 1;
  const rowHeight = gridRowHeight * scale;

  function hasSemesterValue(left: number, right: number, center: number) {
    let ink = 0;
    let textHeight = 0;
    for (let y = center - 5; y <= center + 5; y++) {
      let lineInk = 0;
      for (let x = left + 5; x < right - 5; x++) {
        const value = at(x, y);
        if (value < 211 && Math.max(at(x, y - 4), at(x, y + 4)) - value > 15) lineInk++;
      }
      ink += lineInk;
      if (lineInk >= 2) textHeight++;
    }
    // Empty grades and credits are printed as dashes, with at most a few scanlines of ink.
    return textHeight >= 5 && ink >= 30;
  }

  const columns = [];
  let topCount = 0;
  let bottomCount = 0;
  for (let column = 0; column < 4; column++) {
    const [left, fall, spring, right] = rules.slice(column * 3, column * 3 + 4);
    const firstCenter = headerEnd + (9 - column * .8) * scale;
    const lineCount = Math.min(26, Math.floor((height - 10 - firstCenter) / rowHeight) + 1);
    const lines = Array.from({ length: lineCount }, (_, index) => {
      const center = Math.round(firstCenter + index * rowHeight);
      return { line: index + 1, center, upper: hasSemesterValue(fall, spring, center), lower: hasSemesterValue(spring, right, center) };
    });
    const active = lines.filter(({ upper, lower }) => upper || lower);
    topCount += active.filter(({ line }) => line <= 12).length;
    bottomCount += active.filter(({ line }) => line >= 22).length;
    // Include the next printed line for a wrapped course name or a visible end-of-list marker.
    columns.push({ left, right, headerTop, headerHeight, rowHeight, lines: lines.slice(0, (active.at(-1)?.line ?? 0) + 1) });
  }
  // An upright copy of this form starts listing courses immediately after its headers.
  if (topCount < 10 || topCount < bottomCount * 3) return null;
  return columns;
}
