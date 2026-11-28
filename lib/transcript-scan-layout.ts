import type { TranscriptRow } from "./transcript-review";

export const transcriptScanRotations = [0, 90, 180, 270] as const;
export type ScanRotation = typeof transcriptScanRotations[number];
export type ScanColumn = { left: number; top: number; right: number; bottom: number; expectedRows: number | null; annual?: boolean };
export type TranscriptScanLayout = { rotation: ScanRotation; orientationConfirmed: boolean; columns: ScanColumn[] };

const pageBounds: ScanColumn = { left: 0, top: 0, right: 1000, bottom: 1000, expectedRows: null };

export function isTranscriptPageText(value: string): boolean {
  const title = value.normalize("NFKC").toUpperCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const schoolName = "NATIONALCHENGCHIUNIVERSITY";
  return (title.length >= 16 && schoolName.startsWith(title))
    || (title.length >= 12 && "CHENGCHIUNIVERSITY".startsWith(title))
    || title.startsWith(`${schoolName}NATIONALCHENGCHI`)
    || /^(?:國立政治大學|(?:國立政治大學)?(?:學生學業成績總表|學生成績單|成績單)|ACADEMICTRANSCRIPT|TRANSCRIPTOFRECORDS|科目|課名|以下空白|學期平均成績|累計平均成績|修習學分|實得學分|學分累計|(?:平均|排名|學分)(?:總計|合計))$/u.test(title);
}

export function completeTranscriptRowCount(rows: readonly TranscriptRow[]): number {
  return rows.filter(({ courseName, gradeRaw }) => courseName.trim() && gradeRaw.trim() && !isTranscriptPageText(courseName)).length;
}

export function hasTranscriptRowEvidence({ courseName, courseCode, credits, gradeRaw }: TranscriptRow) {
  return Boolean((courseName.trim() && !isTranscriptPageText(courseName)) || courseCode.trim() || credits !== null || gradeRaw.trim());
}

export function keepReadableTranscriptGridLines(rows: readonly TranscriptRow[]) {
  const key = (row: TranscriptRow) => row.sourceLine ?? row.id;
  const readable = new Set(rows.filter(hasTranscriptRowEvidence).map(key));
  const visibleRows = rows.filter((row) => readable.has(key(row)));
  const unreadableLines = new Set(rows.filter((row) => !readable.has(key(row))).map(key)).size;
  return { rows: visibleRows, unreadableLines };
}

export function isTranscriptGradeDash(value: string): boolean {
  return /^[\s\p{Pd}−]+$/u.test(value) && /[\p{Pd}−]/u.test(value);
}

export function hasIncompleteGridReading(rows: readonly TranscriptRow[], expected: number, discardedPageText: number) {
  return discardedPageText > 0 || completeTranscriptRowCount(rows) < expected;
}

export function transcriptScanCrops(columns: readonly ScanColumn[]): ScanColumn[] {
  if (!columns.length) return [pageBounds];
  const ordered = [...columns].sort((a, b) => a.left - b.left);
  if (ordered.some((column, index) => column.right - column.left < 100 || column.bottom - column.top < 100
    || (index > 0 && ordered[index - 1].right - column.left > 65))) return [pageBounds];

  // Take the course table gutters as boundaries so adjacent crops never repeat a course.
  const boundaries = ordered.slice(1).map((column, index) => Math.round((ordered[index].right + column.left) / 2));
  return ordered.map((column, index) => ({
    ...column,
    left: boundaries[index - 1] ?? Math.max(0, column.left - 24),
    right: boundaries[index] ?? Math.min(1000, column.right + 24),
    top: Math.max(0, column.top - 28),
    bottom: Math.min(1000, column.bottom + 24),
  }));
}

export function preferTranscriptScanRetry(original: readonly TranscriptRow[], retry: readonly TranscriptRow[]): boolean {
  if (retry.length <= original.length) return false;
  const remaining = new Map<string, number>();
  const rowKey = (row: TranscriptRow) => JSON.stringify([
    row.term, row.recognizedSemester ?? "", row.courseName.normalize("NFKC").toLowerCase().replace(/\s+/gu, ""), row.courseCode, gradeKey(row.gradeRaw), row.credits,
  ]);
  for (const row of retry) {
    const key = rowKey(row);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  // Keep recognised rows when a second read changes them instead of filling gaps.
  return original.every((row) => {
    const key = rowKey(row);
    const count = remaining.get(key) ?? 0;
    remaining.set(key, count - 1);
    return count > 0;
  });
}

function identifiableRows(rows: readonly TranscriptRow[]) {
  const byCourse = new Map<string, TranscriptRow | null>();
  for (const row of rows) {
    const title = row.courseName.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
    if (!title || !/^\d+-[123]$/u.test(row.term)) continue;
    const key = JSON.stringify([row.term, title]);
    byCourse.set(key, byCourse.has(key) ? null : row);
  }
  return byCourse;
}

function gradeKey(grade: string) {
  return /^\d+(?:\.\d+)?$/u.test(grade) ? Number(grade) : grade;
}

export function reconcileNumberedTranscriptTitles(original: readonly TranscriptRow[], retry: readonly TranscriptRow[]): TranscriptRow[] {
  const titles = new Map<number, TranscriptRow>();
  const disputed = new Set<number>();
  const titleKey = (name: string) => name.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
  for (const row of original) {
    const line = row.scanLine;
    if (line === undefined || titles.has(line) || disputed.has(line)) continue;
    const reread = retry.find((entry) => entry.scanLine === line && entry.courseName);
    if (!reread) continue;
    if (!row.requiresTitleReview) {
      if (row.courseName && titleKey(row.courseName) !== titleKey(reread.courseName)) disputed.add(line);
      continue;
    }
    const comparable = original.filter((entry) => entry.scanLine === line && entry.gradeRaw).flatMap((entry) => {
      const second = retry.find((item) => item.scanLine === line && item.term === entry.term
        && item.recognizedSemester === entry.recognizedSemester && item.gradeRaw);
      return second ? [gradeKey(entry.gradeRaw) === gradeKey(second.gradeRaw)] : [];
    });
    if (comparable.includes(false) || (row.courseName && (!comparable.length || reread.requiresTitleReview))) continue;
    titles.set(line, reread);
  }
  return original.map((row) => {
    if (row.scanLine !== undefined && disputed.has(row.scanLine)) return { ...row, requiresTitleReview: true };
    const title = row.scanLine === undefined ? undefined : titles.get(row.scanLine);
    if (!title) return row;
    const matching = retry.find((entry) => entry.scanLine === row.scanLine && entry.term === row.term
      && entry.recognizedSemester === row.recognizedSemester);
    return {
      ...row, courseName: title.courseName, requiresTitleReview: title.requiresTitleReview,
      candidates: matching?.candidates,
      requiresOcrReview: !row.courseName && row.gradeRaw && row.credits !== null ? undefined : row.requiresOcrReview,
    };
  });
}

export function reconcileNumberedTranscriptGrades(original: readonly TranscriptRow[], retry: readonly TranscriptRow[]): TranscriptRow[] {
  function key(row: TranscriptRow) {
    const semester = row.recognizedSemester ?? /-([12])$/u.exec(row.term)?.[1];
    return row.scanLine !== undefined && semester ? `${row.scanLine}-${semester}` : "";
  }
  const cells = new Map(retry.map((row) => [key(row), row]));
  return original.map((row) => {
    const id = key(row);
    const second = id ? cells.get(id) : undefined;
    if (!second) return row;
    if ((row.gradeRaw && second.gradeRaw && gradeKey(row.gradeRaw) !== gradeKey(second.gradeRaw))
      || (row.credits !== null && second.credits !== null && row.credits !== second.credits)) {
      return { ...row, requiresOcrReview: true };
    }
    const gradeRaw = row.gradeRaw || second.gradeRaw;
    const credits = row.credits ?? second.credits;
    return { ...row, gradeRaw, credits,
      requiresOcrReview: !row.courseName || !gradeRaw || credits === null ? true : undefined };
  });
}

export function reconcileTranscriptScanRetry(original: readonly TranscriptRow[], retry: readonly TranscriptRow[]): TranscriptRow[] {
  const hasUsableReading = original.some(({ courseName, courseCode, gradeRaw }) => courseName.trim() || courseCode.trim() || gradeRaw.trim());
  if (preferTranscriptScanRetry(original, retry) || (!hasUsableReading && completeTranscriptRowCount(retry))) {
    return [...retry];
  }
  const retryByCourse = identifiableRows(retry);
  const updates = new Map<string, TranscriptRow>();
  for (const [key, row] of identifiableRows(original)) {
    const second = retryByCourse.get(key);
    if (!row || !second) continue;
    const { gradeRaw, credits, courseCode } = row;
    if (courseCode && second.courseCode && courseCode !== second.courseCode) continue;
    if ((gradeRaw && second.gradeRaw && gradeKey(gradeRaw) !== gradeKey(second.gradeRaw))
      || (credits !== null && second.credits !== null && credits !== second.credits)) {
      updates.set(row.id, { ...row, requiresOcrReview: true });
      continue;
    }
    const grade = gradeRaw || second.gradeRaw;
    const mergedCredits = credits ?? second.credits;
    const filledGap = !gradeRaw || credits === null;
    updates.set(row.id, {
      ...row, gradeRaw: grade, credits: mergedCredits, courseCode: courseCode || second.courseCode,
      requiresOcrReview: filledGap && grade && mergedCredits !== null ? undefined : row.requiresOcrReview,
    });
  }
  return original.map((row) => updates.get(row.id) ?? row);
}
