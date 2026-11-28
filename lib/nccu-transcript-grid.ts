export const gridWidth = 1237;
export const gridHeight = 878;

// Expected vertical rules of the four-year, two-semester NCCU transcript form.
const rulePositions = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
export const gridRowHeight = 14;

export type TranscriptGridSlot = { line: number; upper: boolean; lower: boolean };
type GridLine = TranscriptGridSlot & { center: number };
export type TranscriptGridColumn = {
  left: number; right: number; headerTop: number; headerHeight: number; bodyBottom: number; rowHeight: number; lines: GridLine[];
};

export function transcriptBrightnessCurve(gray: Uint8Array): Uint8Array | null {
  const histogram = new Uint32Array(256);
  const step = Math.max(1, Math.floor(gray.length / 65536));
  let samples = 0;
  for (let i = 0; i < gray.length; i += step) {
    histogram[gray[i]]++;
    samples++;
  }
  function percentile(fraction: number) {
    let count = 0;
    return histogram.findIndex((frequency) => (count += frequency) > samples * fraction);
  }
  const paperTone = percentile(.5);
  if (paperTone < 0 || paperTone >= 220 || percentile(.9) - percentile(.02) < 18) return null;

  // Separate dark ink from gray paper while preserving the highlights above the paper tone.
  const pivot = Math.max(100, paperTone);
  const brightPaper = 238;
  return Uint8Array.from({ length: 256 }, (_, value) => Math.round(value <= pivot
    ? value * brightPaper / pivot
    : brightPaper + (value - pivot) * (255 - brightPaper) / (255 - pivot)));
}

export function transcriptInkContrast(gray: Uint8Array, width: number, tileSize = 48): Uint8Array {
  const height = gray.length / width;
  const contrast = new Uint8Array(gray.length);
  const sampleStep = Math.max(1, Math.round(tileSize / 16));
  for (let top = 0; top < height; top += tileSize) {
    const bottom = Math.min(height, top + tileSize);
    for (let left = 0; left < width; left += tileSize) {
      const right = Math.min(width, left + tileSize);
      const samples = [];
      for (let y = top; y < bottom; y += sampleStep) {
        for (let x = left; x < right; x += sampleStep) samples.push(gray[y * width + x]);
      }
      // The local paper tone varies around stamps and folds. Bright watermark text has no dark contrast.
      const paper = samples.sort((a, b) => a - b)[Math.floor(samples.length * .58)];
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const index = y * width + x;
          contrast[index] = Math.max(0, paper - gray[index]);
        }
      }
    }
  }
  return contrast;
}

export function findNccuTranscriptColumns(gray: Uint8Array): { columns: TranscriptGridColumn[] | null; cleaned: boolean } {
  const midtones = gray.reduce((count, value) => count + Number(value >= 125 && value < 220), 0);
  if (midtones > gray.length / 4) {
    const ink = transcriptInkContrast(gray, gridWidth);
    for (const threshold of [42, 36, 48]) {
      const mask = ink.map((value) => value >= threshold ? 0 : 255);
      const layout = locateNccuTranscriptTable(mask);
      if (!layout || layout.bodyBottom >= gray.length / gridWidth) continue;
      const { rules, headerTop, headerHeight, bodyBottom, scale } = layout;
      const columns = [0, 3, 6, 9].map((column) => ({
        left: rules[column], right: rules[column + 3], headerTop, headerHeight, bodyBottom,
        rowHeight: gridRowHeight * scale, lines: [],
      }));
      return { columns, cleaned: true };
    }
  }
  return { columns: readNccuTranscriptGrid(gray), cleaned: false };
}

function locateNccuTranscriptTable(gray: Uint8Array) {
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
  if (rules.some((x, index) => index > 0 && x - rules[index - 1] < 40 * scale)) return null;

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
  const nominalPitch = gridRowHeight * scale;
  let bodyBottom = height;
  for (let y = headerEnd + Math.round(nominalPitch * 9); y < Math.min(height - 2, headerEnd + nominalPitch * 31); y++) {
    // The rule above term totals spans all four years, even on a slightly skewed scan.
    const footer = [0, 3, 6, 9].every((column) => {
      const left = rules[column];
      const right = rules[column + 3];
      let dark = 0;
      for (let x = left; x < right; x += 2) {
        if (Math.min(at(x, y - 2), at(x, y - 1), at(x, y), at(x, y + 1), at(x, y + 2)) < 150) dark++;
      }
      return dark >= (right - left) * .37;
    });
    if (footer) {
      bodyBottom = y;
      break;
    }
  }
  return { rules, headerTop, headerEnd, headerHeight, bodyBottom, scale };
}

export function readNccuTranscriptGrid(gray: Uint8Array): TranscriptGridColumn[] | null {
  const layout = locateNccuTranscriptTable(gray);
  if (!layout) return null;
  const { rules, headerTop, headerEnd, headerHeight, bodyBottom, scale } = layout;
  const height = gray.length / gridWidth;
  const at = (x: number, y: number) => gray[y * gridWidth + x];
  const nominalPitch = gridRowHeight * scale;
  const gradeColumns = Array.from({ length: 4 }, (_, column) => {
    const [left, fall, spring, right] = rules.slice(column * 3, column * 3 + 4);
    const first = headerEnd + (9 - column * .8) * scale;
    const upper = new Uint16Array(height);
    const lower = new Uint16Array(height);
    for (let y = headerEnd + 3; y < Math.min(height - 4, bodyBottom - 3, headerEnd + nominalPitch * 30); y++) {
      for (const [start, end, ink] of [[fall, spring, upper], [spring, right, lower]] as const) {
        for (let x = start + 5; x < end - 5; x++) {
          const value = at(x, y);
          if (value < 211 && Math.max(at(x, y - 4), at(x, y + 4)) - value > 15) ink[y]++;
        }
      }
    }
    return { left, right, first, upper, lower };
  });

  // Repeated grade strokes reveal vertical spacing independently of horizontal scaling.
  const evidence = gradeColumns.flatMap(({ first, upper, lower }) => {
    const points = [];
    for (let y = headerEnd + 3; y < Math.min(height - 4, first + nominalPitch * 27); y++) {
      const ink = Math.min(20, Math.max(0, upper[y] + lower[y] - 4));
      if (ink) points.push({ position: y - first, ink });
    }
    return points;
  });
  let rowHeight = nominalPitch;
  let rowShift = 0;
  if (evidence.some(({ position }) => position >= nominalPitch * 5)) {
    const totalInk = evidence.reduce((sum, { ink }) => sum + ink, 0);
    let best = 0;
    for (let step = -16; step <= 16; step++) {
      const pitch = nominalPitch + step * .125;
      for (let shift = -2; shift <= 2; shift += .5) {
        const alignment = evidence.reduce((sum, { position, ink }) =>
          sum + ink * Math.cos(2 * Math.PI * (position - shift) / pitch), 0) / totalInk;
        // Prefer the printed form's nominal spacing when the ink fits equally well.
        const score = alignment - Math.abs(step) * .001 - Math.abs(shift) * .01;
        if (score <= best) continue;
        best = score;
        rowHeight = pitch;
        rowShift = shift;
      }
    }
    if (best < .16) return null;
  }

  function hasSemesterValue(inkByLine: Uint16Array, center: number) {
    const scan = inkByLine.subarray(Math.max(0, center - 5), center + 6);
    // Empty grades and credits are printed as dashes, with at most a few scanlines of ink.
    return scan.filter((ink) => ink >= 2).length >= 5 && scan.reduce((sum, ink) => sum + ink, 0) >= 30;
  }

  const columns = [];
  let topCount = 0;
  let bottomCount = 0;
  for (const { left, right, first, upper, lower } of gradeColumns) {
    const firstCenter = first + rowShift;
    const lineCount = Math.min(26, Math.floor((Math.min(height - 10, bodyBottom - 6) - firstCenter) / rowHeight) + 1);
    const lines = Array.from({ length: lineCount }, (_, index) => {
      const center = Math.round(firstCenter + index * rowHeight);
      return { line: index + 1, center, upper: hasSemesterValue(upper, center), lower: hasSemesterValue(lower, center) };
    });
    const active = lines.filter(({ upper, lower }) => upper || lower);
    topCount += active.filter(({ line }) => line <= 12).length;
    bottomCount += active.filter(({ line }) => line >= 22).length;
    // Include the next printed line for a wrapped course name or a visible end-of-list marker.
    columns.push({ left, right, headerTop, headerHeight, bodyBottom, rowHeight, lines: lines.slice(0, (active.at(-1)?.line ?? 0) + 1) });
  }
  // An upright copy of this form starts listing courses immediately after its headers.
  if (topCount < 10 || topCount < bottomCount * 3) return null;
  return columns;
}
