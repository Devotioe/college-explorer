export type TranscriptCandidate = {
  code: string;
  title: string;
  credits: number | null;
  department: string;
  confidence: number;
};

export type TranscriptRow = {
  id: string;
  term: string;
  courseCode: string;
  courseName: string;
  credits: number | null;
  gradeRaw: string;
  confidence: number;
  candidates?: TranscriptCandidate[];
};

export type TranscriptHistory = {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  confirmedAt: string | null;
  rows: TranscriptRow[];
};

export type Semester = "1" | "2" | "3";
type Grade = Pick<TranscriptRow, "id" | "courseCode" | "credits" | "gradeRaw" | "confidence" | "candidates">;

export type TranscriptReviewRow = {
  id: string;
  year: string;
  courseName: string;
  semesters: Partial<Record<Semester, Grade>>;
  unassigned?: Grade & { term: string };
};

export const semesterLabels: Record<Semester, string> = { "1": "上學期", "2": "下學期", "3": "暑修" };

function academicYear(value: string) {
  const text = value.normalize("NFKC").trim();
  if (!/^\d{2,4}$/u.test(text)) return "";
  const digits = Number(text);
  const year = digits >= 1912 ? digits - 1911 : digits;
  return year >= 1 && year <= 999 ? String(year) : "";
}

function splitTerm(value: string) {
  const text = value.normalize("NFKC").trim().replace(/[‐‑–—−]/gu, "-");
  const match = /^(\d{2,4})(?:\s*學年度?)?\s*(?:[-/.]\s*)?(?:第\s*)?(上|下|暑修|[123])?\s*(?:學期)?$/u.exec(text);
  const year = academicYear(match?.[1] ?? "");
  const normalized = { 上: "1", 下: "2", 暑修: "3", 1: "1", 2: "2", 3: "3" } as const;
  const semester = normalized[match?.[2] as keyof typeof normalized];
  return { year, semester: year ? semester : undefined };
}

export function normalizeTranscriptTerm(value: string) {
  const { year, semester } = splitTerm(value);
  return semester ? `${year}-${semester}` : value.trim();
}

function courseFamily(code: string) {
  const key = code.normalize("NFKC").toUpperCase().replace(/[\s-]/gu, "");
  return /^[A-Z0-9]{6}\d{3}$/u.test(key) ? key.slice(0, 6) : key;
}

export function groupTranscriptForReview(rows: readonly TranscriptRow[]): TranscriptReviewRow[] {
  const groups: TranscriptReviewRow[] = [];
  const byCourse = new Map<string, TranscriptReviewRow[]>();
  for (const { courseName, term, ...grade } of rows) {
    const { year, semester } = splitTerm(term);
    const title = courseName.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
    const key = JSON.stringify([year, title]);
    const family = courseFamily(grade.courseCode);
    const candidates = byCourse.get(key) ?? [];
    const compatible = semester && candidates.filter((row) => !row.semesters[semester]
      && Object.values(row.semesters).every(({ courseCode }) => !family || !courseCode.trim() || courseFamily(courseCode) === family));
    const row = compatible && compatible.length === 1 ? compatible[0] : null;
    if (row && semester) {
      row.semesters[semester] = grade;
      continue;
    }
    const entry: TranscriptReviewRow = { id: grade.id, year, courseName, semesters: {} };
    if (semester) {
      entry.semesters[semester] = grade;
      byCourse.set(key, [...candidates, entry]);
    } else {
      entry.unassigned = { ...grade, term };
    }
    groups.push(entry);
  }
  return groups;
}

export function editSemesterGrade(row: TranscriptReviewRow, semester: Semester, patch: Partial<Grade>): TranscriptReviewRow {
  const current = row.semesters[semester] ?? {
    id: `${row.id}-${semester}`, courseCode: "", credits: null, gradeRaw: "", confidence: 0,
  };
  return { ...row, semesters: { ...row.semesters, [semester]: { ...current, ...patch } } };
}

export function assignTranscriptSemester(row: TranscriptReviewRow, semester: Semester): TranscriptReviewRow {
  if (!row.unassigned || row.semesters[semester]) return row;
  const { term, ...grade } = row.unassigned;
  return { ...editSemesterGrade(row, semester, grade), unassigned: undefined };
}

export function confirmedTranscriptRows(review: readonly TranscriptReviewRow[]): { rows: TranscriptRow[] } | { error: string } {
  const rows: TranscriptRow[] = [];
  for (const [index, entry] of review.entries()) {
    if (entry.unassigned) return { error: `第 ${index + 1} 列請先指定成績屬於哪個學期。` };
    const grades = Object.entries(entry.semesters).filter(([, row]) => row.gradeRaw.trim());
    if (!grades.length) continue;
    const year = academicYear(entry.year);
    const courseName = entry.courseName.trim();
    if (!year || !courseName) return { error: `第 ${index + 1} 列請填寫有效學年度和科目名稱。` };
    for (const [semester, { gradeRaw, ...row }] of grades) {
      rows.push({ ...row, term: `${year}-${semester}`, courseName, gradeRaw: gradeRaw.trim() });
    }
  }
  if (!rows.length) return { error: "請至少確認一筆成績。" };
  if (rows.length > 300) return { error: "一份成績單最多可保存 300 筆學期成績。" };
  return { rows };
}
