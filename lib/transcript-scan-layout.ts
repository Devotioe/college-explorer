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

export function isTranscriptGradeDash(value: string): boolean {
  return /^[\s\p{Pd}−]+$/u.test(value) && /[\p{Pd}−]/u.test(value);
}

export function needsUncutTranscriptRetry(rows: readonly TranscriptRow[], expected: number, discardedPageText: number) {
  return discardedPageText > 0 || completeTranscriptRowCount(rows) * 3 < expected * 2;
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
    row.term, row.recognizedSemester ?? "", row.courseName.normalize("NFKC").replace(/\s+/gu, ""), row.courseCode, row.gradeRaw, row.credits,
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
