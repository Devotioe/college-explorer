export const gridWidth = 1237;
export const gridHeight = 878;

// Expected vertical rules of the four-year, two-semester NCCU transcript form.
const rulePositions = [39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191];
export const gridRowHeight = 14;

export type TranscriptGridSlot = { line: number; upper: boolean; lower: boolean };
export type TranscriptGridLine = TranscriptGridSlot & { center: number; upperCenter: number; lowerCenter: number };
export type TranscriptGridColumn = {
  left: number; upperLeft: number; lowerLeft: number; right: number;
  headerTop: number; headerHeight: number; bodyBottom: number; rowHeight: number; lines: TranscriptGridLine[];
};

export function transcriptGridFields({ left, upperLeft, lowerLeft, right }: TranscriptGridColumn) {
  return [
    { field: "titles", left, right: upperLeft },
    { field: "upper", left: upperLeft, right: lowerLeft },
    { field: "lower", left: lowerLeft, right },
  ] as const;
}

export function transcriptGridCellId(line: number, semester: "upper" | "lower") {
  return (semester === "upper" ? 100 : 200) + line;
}

type GridTitleReading = { line: number; courseName: string | null };
type GridCellReading = { id: number; credits: number | null; grade: string | null };

export function assembleTranscriptGridCells(
  slots: readonly TranscriptGridSlot[], titles: readonly GridTitleReading[], cells: readonly GridCellReading[],
) {
  function unique<T>(values: readonly T[], key: (entry: T) => number) {
    const byId = new Map<number, T | null>();
    for (const entry of values) {
      const id = key(entry);
      byId.set(id, byId.has(id) ? null : entry);
    }
    return byId;
  }
  const byLine = unique(titles, (entry) => entry.line);
  const byCell = unique(cells, (entry) => entry.id);
  return slots.map((slot) => {
    const upper = slot.upper ? byCell.get(transcriptGridCellId(slot.line, "upper")) : null;
    const lower = slot.lower ? byCell.get(transcriptGridCellId(slot.line, "lower")) : null;
    return {
      line: slot.line, courseName: byLine.get(slot.line)?.courseName ?? null,
      upperCredits: upper?.credits ?? null, upperGrade: upper?.grade ?? null,
      lowerCredits: lower?.credits ?? null, lowerGrade: lower?.grade ?? null,
    };
  });
}

const linesPerOcrBatch = 7;

export function transcriptGridBatches(lines: readonly TranscriptGridLine[], size = linesPerOcrBatch) {
  return Array.from({ length: Math.ceil(lines.length / size) }, (_, index) => {
    const start = index * size;
    const end = start + size;
    const next = lines[end];
    return { lines: lines.slice(start, end), continuation: next && !next.upper && !next.lower ? next : undefined };
  });
}

export function transcriptGridSummaryBounds(column: TranscriptGridColumn, height: number) {
  const located = column.bodyBottom < height;
  const divider = located ? column.bodyBottom : column.headerTop + column.headerHeight + 28 * column.rowHeight;
  const top = Math.max(0, divider - (located ? 1 : 3) * column.rowHeight);
  const bottom = Math.min(height, divider + (located ? 6.5 : 8) * column.rowHeight);
  if (bottom - top < 2 * column.rowHeight) return null;
  return {
    left: Math.floor(column.left * 1000 / gridWidth), right: Math.ceil(column.right * 1000 / gridWidth),
    top: Math.floor(top * 1000 / height), bottom: Math.ceil(bottom * 1000 / height), expectedRows: null,
  };
}

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
    let fallback: TranscriptGridColumn[] | undefined;
    for (const threshold of [42, 36, 48]) {
      const mask = ink.map((value) => value >= threshold ? 0 : 255);
      const layout = locateNccuTranscriptTable(mask);
      if (!layout || layout.bodyBottom >= gray.length / gridWidth) continue;
      const numbered = readNccuTranscriptRows(mask, layout);
      if (numbered) return { columns: numbered, cleaned: true };
      const { rules, headerTop, headerHeight, bodyBottom, scale } = layout;
      fallback ??= [0, 3, 6, 9].map((column) => ({
        left: rules[column], upperLeft: rules[column + 1], lowerLeft: rules[column + 2], right: rules[column + 3],
        headerTop, headerHeight, bodyBottom,
        rowHeight: gridRowHeight * scale, lines: [],
      }));
    }
    if (fallback) return { columns: fallback, cleaned: true };
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
  return layout ? readNccuTranscriptRows(gray, layout) : null;
}

function readNccuTranscriptRows(gray: Uint8Array, layout: NonNullable<ReturnType<typeof locateNccuTranscriptTable>>) {
  const { rules, headerTop, headerEnd, headerHeight, bodyBottom, scale } = layout;
  const height = gray.length / gridWidth;
  const at = (x: number, y: number) => gray[y * gridWidth + x];
  const nominalPitch = gridRowHeight * scale;
  function localHeader(left: number, right: number) {
    let best = headerEnd;
    let strength = (right - left - 8) * .3;
    for (let y = Math.max(4, headerEnd - 7); y <= headerEnd + 7; y++) {
      let signal = 0;
      for (let x = left + 4; x < right - 4; x += 2) {
        if (Math.max(at(x, y - 4), at(x, y + 4)) - at(x, y) > 14) signal++;
      }
      const score = signal - .15 * Math.abs(y - headerEnd);
      if (score <= strength) continue;
      strength = score;
      best = y;
    }
    return best;
  }
  function scanSemester(start: number, end: number, first: number) {
    const strong = new Uint16Array(height);
    const credit = new Uint16Array(height);
    const grade = new Uint16Array(height);
    const middle = (start + end) / 2;
    const width = end - start - 10;
    for (let y = Math.max(4, Math.floor(first - nominalPitch)); y < Math.min(height - 4, bodyBottom - 3, first + nominalPitch * 28); y++) {
      let dark = 0;
      let leftInk = 0;
      let rightInk = 0;
      let run = 0;
      let longest = 0;
      for (let x = start + 5; x < end - 5; x++) {
        const value = at(x, y);
        if (value >= 235 || Math.max(at(x, y - 4), at(x, y + 4)) - value <= 16) {
          run = 0;
          continue;
        }
        longest = Math.max(longest, ++run);
        if (value < 211) dark++;
        if (x < middle) leftInk++;
        else rightInk++;
      }
      // A form rule or a highlighter edge can be darker than the text across the entire semester.
      if (longest >= width * .45 || leftInk + rightInk >= width * .66) continue;
      strong[y] = dark;
      credit[y] = leftInk;
      grade[y] = rightInk;
    }
    return { strong, credit, grade };
  }
  function alignmentInk(scan: ReturnType<typeof scanSemester>, y: number) {
    return Math.max(scan.strong[y] ?? 0, 2 * Math.min(scan.credit[y] ?? 0, scan.grade[y] ?? 0));
  }
  const gradeColumns = Array.from({ length: 4 }, (_, column) => {
    const [left, fall, spring, right] = rules.slice(column * 3, column * 3 + 4);
    const columnHeader = localHeader(left, fall);
    const first = columnHeader + 9 * scale;
    const upperOffset = localHeader(fall, spring) - columnHeader;
    const lowerOffset = localHeader(spring, right) - columnHeader;
    const upper = scanSemester(fall, spring, first);
    const lower = scanSemester(spring, right, first);
    const evidence = [];
    for (let y = Math.max(4, Math.floor(first - nominalPitch / 2)); y < Math.min(height - 4, first + nominalPitch * 26); y++) {
      const ink = Math.min(20, Math.max(0, alignmentInk(upper, y + upperOffset) + alignmentInk(lower, y + lowerOffset) - 4));
      if (ink) evidence.push({ position: y - first, ink });
    }
    return { left, upperLeft: fall, lowerLeft: spring, right, columnHeader, first, upperOffset, lowerOffset, upper, lower, evidence };
  });

  // Fit a common row spacing for sparse columns, then calibrate each populated column against its own strokes.
  function fitRows(evidence: (typeof gradeColumns)[number]["evidence"], initialPitch: number, limit: number, phaseLimit: number) {
    const totalInk = evidence.reduce((sum, { ink }) => sum + ink, 0);
    let result = { rowHeight: initialPitch, rowShift: 0, score: 0 };
    if (!totalInk) return result;
    const pitchSteps = evidence.some(({ position }) => position >= initialPitch * 5) ? limit : 0;
    for (let step = -pitchSteps; step <= pitchSteps; step++) {
      const pitch = initialPitch + step * .125;
      for (let shift = -phaseLimit; shift <= phaseLimit; shift += .5) {
        const alignment = evidence.reduce((sum, { position, ink }) =>
          sum + ink * Math.cos(2 * Math.PI * (position - shift) / pitch), 0) / totalInk;
        const score = alignment - Math.abs(step) * .001 - Math.abs(shift) * .01;
        if (score > result.score) result = { rowHeight: pitch, rowShift: shift, score };
      }
    }
    return result;
  }
  const common = fitRows(gradeColumns.flatMap(({ evidence }) => evidence), nominalPitch, 16, 2);
  const commonPitch = common.score >= .16 ? common.rowHeight : nominalPitch;

  function hasSemesterValue(semester: ReturnType<typeof scanSemester>, center: number) {
    function hasStrokes(inkByLine: Uint16Array, minimumInk: number) {
      const scan = inkByLine.subarray(Math.max(0, center - 5), center + 6);
      return scan.filter((ink) => ink >= 2).length >= 5 && scan.reduce((sum, ink) => sum + ink, 0) >= minimumInk;
    }
    // Faint numbers should have separate credit and grade strokes. A lone pale mark may be a watermark.
    return hasStrokes(semester.strong, 30) || (hasStrokes(semester.credit, 18) && hasStrokes(semester.grade, 24));
  }

  const columns = [];
  let topCount = 0;
  let bottomCount = 0;
  for (const { left, upperLeft, lowerLeft, right, columnHeader, first, upperOffset, lowerOffset, upper, lower, evidence } of gradeColumns) {
    const local = fitRows(evidence, commonPitch, 12, 4);
    const { rowHeight, rowShift } = local.score >= .16 ? local : { rowHeight: commonPitch, rowShift: 0 };
    const firstCenter = first + rowShift;
    const lastCenter = Math.min(height - 10, bodyBottom - 6) - Math.max(0, upperOffset, lowerOffset);
    const lineCount = Math.min(26, Math.floor((lastCenter - firstCenter) / rowHeight) + 1);
    const lines = Array.from({ length: lineCount }, (_, index) => {
      const center = Math.round(firstCenter + index * rowHeight);
      const upperCenter = center + upperOffset;
      const lowerCenter = center + lowerOffset;
      return { line: index + 1, center, upperCenter, lowerCenter,
        upper: hasSemesterValue(upper, upperCenter), lower: hasSemesterValue(lower, lowerCenter) };
    });
    const active = lines.filter(({ upper, lower }) => upper || lower);
    topCount += active.filter(({ line }) => line <= 12).length;
    bottomCount += active.filter(({ line }) => line >= 22).length;
    // Include the next printed line for a wrapped course name or a visible end-of-list marker.
    const localHeaderTop = Math.max(0, headerTop + columnHeader - headerEnd);
    columns.push({ left, upperLeft, lowerLeft, right, headerTop: localHeaderTop,
      headerHeight: Math.min(headerHeight, columnHeader + 1), bodyBottom, rowHeight,
      lines: lines.slice(0, (active.at(-1)?.line ?? 0) + 1) });
  }
  // An upright copy of this form starts listing courses immediately after its headers.
  if (topCount < 10 || topCount < bottomCount * 3) return null;
  return columns;
}
