import courseIndex from "../data/nccu-course-index.json" with { type: "json" };
import officialCatalog from "../data/nccu-transcript-catalog.json" with { type: "json" };
import { curricula } from "./curricula";
import { classifyNccuCourse, isNccuCommerceCoreTitle, normalizeNccuDepartment, preferNccuTranscriptTerm } from "./nccu-study-profile";

type IndexCourse = Pick<(typeof courseIndex)[number], "code" | "title" | "titleEn" | "credits" | "department" | "offeredTerms">;
type OfficialCourse = [code: string, title: string, department: string, credits: number | null, offeredTerms: string[]];
export type TranscriptCandidate = Pick<IndexCourse, "code" | "title" | "credits" | "department"> & { confidence: number };

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replaceAll("臺", "台").replace(/[\s\p{P}\p{S}]/gu, "");
}

function courseFamily(code: string) {
  return /^[A-Z\d]{6}\d{3}$/u.test(code) ? code.slice(0, 6) : code;
}

function subjectTitle(code: string, title: string) {
  return `${courseFamily(code)}:${normalize(title)}`;
}

const baseBySubjectTitle = new Map(courseIndex.map((course) => [subjectTitle(course.code, course.title), course]));
const officialRows = officialCatalog.courses as OfficialCourse[];
const coveredSubjects = new Set(officialRows.map(([code, title]) => subjectTitle(code, title)));
const transcriptCourseIndex: IndexCourse[] = officialRows.map(([code, title, department, credits, offeredTerms]) => ({
  code, title, department, credits, offeredTerms, titleEn: baseBySubjectTitle.get(subjectTitle(code, title))?.titleEn ?? "",
}));
for (const [key, course] of baseBySubjectTitle) {
  if (!coveredSubjects.has(key)) transcriptCourseIndex.push(course);
}

export const nccuTranscriptCatalog = transcriptCourseIndex.map(({ code, title, department, credits, offeredTerms }) => ({
  id: code, school: "NCCU", code, title, unit: department, credits, offeredTerms,
}));

const coursesByTitle = new Map<string, IndexCourse[]>();
const coursesBySearchName = new Map<string, IndexCourse[]>();
for (const course of transcriptCourseIndex) {
  const key = normalize(course.title);
  addToIndex(coursesByTitle, key, course);
  addToIndex(coursesBySearchName, key, course);
  const english = normalize(course.titleEn);
  if (english && english !== key) addToIndex(coursesBySearchName, english, course);
}

function addToIndex(index: Map<string, IndexCourse[]>, key: string, course: IndexCourse) {
  const matches = index.get(key);
  if (matches) matches.push(course);
  else index.set(key, [course]);
}

export function nccuTranscriptCurriculum(department: string, admissionYear: string) {
  return curricula.find((item) => item.school === "NCCU" && item.department === department && item.year === Number(admissionYear));
}

export function resolveNccuTranscriptCourse(row: { courseName: string; courseCode: string; credits: number | null; term: string },
  department: string, admissionYear: string) {
  if (row.courseCode.trim() || !department || isNccuCommerceCoreTitle(row.courseName)) return undefined;
  const home = normalizeNccuDepartment(department);
  if (!home) return undefined;
  const title = normalize(row.courseName);
  const exact = preferNccuTranscriptTerm(coursesByTitle.get(title) ?? [], row.term);
  const requirement = nccuTranscriptCurriculum(home, admissionYear)?.required.find((item) => normalize(item.title) === title);
  const official = requirement?.code;
  const byRequirement = (course: IndexCourse) => official && (course.code === official || courseFamily(course.code) === official);
  let candidates = exact.filter(({ code, department: unit }) => classifyNccuCourse({ code, unit })?.department === home);
  if (!candidates.length) return undefined;
  const exactRequirement = candidates.filter(byRequirement);
  const usedRequirement = exactRequirement.length > 0 && new Set(candidates.map(({ code }) => courseFamily(code))).size > 1;
  if (exactRequirement.length) candidates = exactRequirement;
  if (row.credits !== null) {
    const matchingCredits = candidates.filter(({ credits }) => credits === row.credits);
    if (matchingCredits.length) candidates = matchingCredits;
  }
  const families = new Set(candidates.map(({ code }) => courseFamily(code)));
  if (families.size !== 1) return undefined;
  const codes = new Set(candidates.map(({ code }) => code));
  return { code: codes.size === 1 ? candidates[0].code : courseFamily(candidates[0].code),
    reason: usedRequirement ? "curriculum" as const : "home-department" as const };
}

function bigrams(normalized: string) {
  const set = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) set.add(normalized.slice(index, index + 2));
  return set;
}

const searchNames = [...coursesBySearchName].map(([name, courses]) => ({ grams: bigrams(name), courses }));

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

export function matchNccuCourse(name: string, credits: number | null, term: string) {
  const normalizedName = normalize(name);
  const exact = coursesBySearchName.get(normalizedName);
  const candidates = new Map<string, TranscriptCandidate>();
  const query = bigrams(normalizedName);
  const matches = exact ? [{ courses: exact, score: 1 }] : searchNames.map(({ grams, courses }) => ({ courses, score: similarity(query, grams) }));
  for (const { courses, score } of matches) {
    if (score < 0.35 / 0.9) continue;
    for (const course of courses) {
      const creditScore = credits == null || course.credits == null ? 0 : Number(course.credits) === Number(credits) ? 0.06 : -0.04;
      const termScore = term && course.offeredTerms.includes(term) ? 0.04 : 0;
      const confidence = Math.min(0.99, score * 0.9 + creditScore + termScore);
      if (confidence < 0.45) continue;
      const { code, title, department } = course;
      const unit = classifyNccuCourse({ code, unit: department })?.department ?? department;
      const key = JSON.stringify([subjectTitle(code, title), unit]);
      if ((candidates.get(key)?.confidence ?? 0) < confidence) candidates.set(key, { code, title, credits: course.credits, department, confidence });
    }
  }
  return [...candidates.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
