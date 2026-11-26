export const gridWidth = 1237;
export const gridHeight = 878;

// Expected vertical rules of the four-year, two-semester NCCU transcript form.
const rulePositions = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
export const gridRowHeight = 14;

export type TranscriptGridSlot = { line: number; upper: boolean; lower: boolean };
type GridLine = TranscriptGridSlot & { center: number };
export type TranscriptGridColumn = { left: number; right: number; headerTop: number; lines: GridLine[] };

export function readNccuTranscriptGrid(gray: Uint8Array): TranscriptGridColumn[] | null {
  if (gray.length !== gridWidth * gridHeight) return null;
  const at = (x: number, y: number) => gray[y * gridWidth + x];

  const rules = rulePositions.map((expected) => {
    let match = { x: expected, strength: 0 };
    for (let x = expected - 8; x <= expected + 8; x++) {
      let strength = 0;
      for (let y = 300; y < 570; y += 2) {
        if (Math.max(at(x - 6, y), at(x + 6, y)) - at(x, y) > 12) strength++;
      }
      if (strength > match.strength) match = { x, strength };
    }
    return match;
  });
  if (rules.filter(({ strength }) => strength >= 88).length < 11) return null;

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
    const [left, fall, spring, right] = rules.slice(column * 3, column * 3 + 4).map(({ x }) => x);
    const lines = Array.from({ length: 26 }, (_, index) => {
      const center = Math.round(216 - column * .8 + index * gridRowHeight);
      return { line: index + 1, center, upper: hasSemesterValue(fall, spring, center), lower: hasSemesterValue(spring, right, center) };
    });
    const active = lines.filter(({ upper, lower }) => upper || lower);
    topCount += active.filter(({ line }) => line <= 12).length;
    bottomCount += active.filter(({ line }) => line >= 22).length;
    // Include the next printed line for a wrapped course name or a visible end-of-list marker.
    columns.push({ left, right, headerTop: 160, lines: lines.slice(0, (active.at(-1)?.line ?? 0) + 1) });
  }
  // An upright copy of this form starts listing courses immediately after its headers.
  if (topCount < 10 || topCount < bottomCount * 3) return null;
  return columns;
}
