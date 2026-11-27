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
  recognizedSemester?: Semester;
  sourceLine?: string;
  requiresOcrReview?: true;
  ungraded?: true;
};

export type TranscriptHistory = {
  id: string;
  fileName: string;
  fileType: string;
  homeDepartment?: string | null;
  admissionYear?: string | null;
  createdAt: string;
  confirmedAt: string | null;
  rows: TranscriptRow[];
};

export type Semester = "1" | "2" | "3";
type Grade = Pick<TranscriptRow, "id" | "courseCode" | "credits" | "gradeRaw" | "confidence" | "candidates" | "requiresOcrReview">;

export type TranscriptReviewRow = {
  id: string;
  year: string;
  courseName: string;
  semesters: Partial<Record<Semester, Grade>>;
  unassigned?: Grade & { term: string };
};

export const semesterLabels: Record<Semester, string> = { "1": "上學期", "2": "下學期", "3": "暑修" };

export function normalizeTranscriptAcademicYear(value: string) {
  const text = value.normalize("NFKC").trim();
  if (!/^\d{2,4}$/u.test(text)) return "";
  const digits = Number(text);
  const year = digits >= 1912 ? digits - 1911 : digits;
  return year >= 1 && year <= 999 ? String(year) : "";
}

function splitTerm(value: string) {
  const text = value.normalize("NFKC").trim().replace(/[‐‑–—−]/gu, "-");
  const match = /^(\d{2,4})(?:\s*學年度?)?\s*(?:[-/.]\s*)?(?:第\s*)?(上|下|暑修|[123])?\s*(?:學期)?$/u.exec(text);
  const year = normalizeTranscriptAcademicYear(match?.[1] ?? "");
  const normalized = { 上: "1", 下: "2", 暑修: "3", 1: "1", 2: "2", 3: "3" } as const;
  const semester = normalized[match?.[2] as keyof typeof normalized];
  return { year, semester: year ? semester : undefined };
}

export function normalizeTranscriptTerm(value: string) {
  const { year, semester } = splitTerm(value);
  return semester ? `${year}-${semester}` : value.trim();
}

export function resolveOcrTranscriptPeriod(yearLabel: string, semesterLabel: string, earliestYear: string): Pick<TranscriptRow, "term" | "recognizedSemester"> {
  const printedYear = /^(?:(?:民國|西元)\s*)?(?:學年度?\s*:?\s*)?(\d{2,4})(?:\s*(?:學年度?|年))?$/u
    .exec(yearLabel.normalize("NFKC").trim())?.[1] ?? "";
  const year = normalizeTranscriptAcademicYear(printedYear);
  const printedSemester = /^(?:第\s*)?(上|下|暑修|一|二|三|[123])(?:\s*學期)?$/u
    .exec(semesterLabel.normalize("NFKC").trim())?.[1] ?? "";
  const semesters: Partial<Record<string, Semester>> = { 上: "1", 下: "2", 暑修: "3", 一: "1", 二: "2", 三: "3", 1: "1", 2: "2", 3: "3" };
  const semester = semesters[printedSemester];
  if (!year || (earliestYear && Number(year) < Number(earliestYear))) return { term: "", recognizedSemester: semester };
  return { term: semester ? `${year}-${semester}` : year };
}

function courseFamily(code: string) {
  const key = code.normalize("NFKC").toUpperCase().replace(/[\s-]/gu, "");
  return /^[A-Z0-9]{6}\d{3}$/u.test(key) ? key.slice(0, 6) : key;
}

export function groupTranscriptForReview(rows: readonly TranscriptRow[]): TranscriptReviewRow[] {
  const groups: TranscriptReviewRow[] = [];
  const byCourse = new Map<string, TranscriptReviewRow[]>();
  for (const { courseName, term, recognizedSemester, sourceLine, ungraded, ...grade } of rows) {
    const parsed = splitTerm(term);
    const { year } = parsed;
    const semester = parsed.semester ?? recognizedSemester;
    const title = courseName.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
    const key = sourceLine ? JSON.stringify([sourceLine]) : JSON.stringify([year, title]);
    const canGroup = sourceLine || (title && year);
    const family = courseFamily(grade.courseCode);
    const candidates = byCourse.get(key) ?? [];
    const compatible = canGroup && semester && candidates.filter((row) => !row.semesters[semester]
      && Object.values(row.semesters).every(({ courseCode }) => !family || !courseCode.trim() || courseFamily(courseCode) === family));
    const row = compatible && compatible.length === 1 ? compatible[0] : null;
    if (row && semester) {
      row.semesters[semester] = grade;
      continue;
    }
    const entry: TranscriptReviewRow = { id: grade.id, year, courseName, semesters: {} };
    if (semester) {
      entry.semesters[semester] = grade;
      if (canGroup) byCourse.set(key, [...candidates, entry]);
    } else if (!ungraded) {
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
    const courseName = entry.courseName.trim();
    const hasCourseData = Object.values(entry.semesters).some(({ gradeRaw, credits, courseCode, requiresOcrReview }) =>
      gradeRaw.trim() || credits !== null || courseCode.trim() || requiresOcrReview);
    if (!courseName && (entry.unassigned || hasCourseData)) {
      return { error: `第 ${index + 1} 列課名待核對，請對照原檔填寫科目名稱，或移除該列。` };
    }
    if (entry.unassigned) return { error: `第 ${index + 1} 列請先指定成績屬於哪個學期。` };
    const grades = Object.entries(entry.semesters).filter(([, row]) => row.gradeRaw.trim());
    if (!grades.length) continue;
    const year = normalizeTranscriptAcademicYear(entry.year);
    if (!year || !courseName) return { error: `第 ${index + 1} 列請填寫有效學年度和科目名稱。` };
    for (const [semester, row] of grades) {
      rows.push({ id: row.id, courseCode: row.courseCode, credits: row.credits, confidence: row.confidence,
        candidates: row.candidates, term: `${year}-${semester}`, courseName, gradeRaw: row.gradeRaw.trim() });
    }
  }
  if (!rows.length) return { error: "請至少確認一筆成績。" };
  if (rows.length > 300) return { error: "一份成績單最多可保存 300 筆學期成績。" };
  return { rows };
}
