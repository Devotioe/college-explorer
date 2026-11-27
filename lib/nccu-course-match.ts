import courseIndex from "../data/nccu-course-index.json" with { type: "json" };
import { curricula } from "./curricula";
import { classifyNccuCourse, normalizeNccuDepartment } from "./nccu-study-profile";

type IndexCourse = (typeof courseIndex)[number];
export type TranscriptCandidate = Pick<IndexCourse, "code" | "title" | "credits" | "department"> & { confidence: number };

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replaceAll("臺", "台").replace(/[\s\p{P}\p{S}]/gu, "");
}

const coursesByTitle = new Map<string, IndexCourse[]>();
for (const course of courseIndex) {
  const key = normalize(course.title);
  const group = coursesByTitle.get(key);
  if (group) group.push(course);
  else coursesByTitle.set(key, [course]);
}

function courseFamily(code: string) {
  return /^[A-Z\d]{9}$/u.test(code) ? code.slice(0, 6) : code;
}

export function nccuTranscriptCurriculum(department: string, admissionYear: string) {
  return curricula.find((item) => item.school === "NCCU" && item.department === department && item.year === Number(admissionYear));
}

export function resolveNccuTranscriptCourse(row: { courseName: string; courseCode: string; credits: number | null; term: string },
  department: string, admissionYear: string) {
  if (row.courseCode.trim() || !department) return undefined;
  const home = normalizeNccuDepartment(department);
  if (!home) return undefined;
  const title = normalize(row.courseName);
  const exact = coursesByTitle.get(title) ?? [];
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
  const offered = row.term ? candidates.filter(({ offeredTerms }) => offeredTerms.includes(row.term)) : [];
  if (offered.length) candidates = offered;
  if (new Set(candidates.map(({ code }) => courseFamily(code))).size !== 1) return undefined;
  return { code: candidates[0].code, reason: usedRequirement ? "curriculum" as const : "home-department" as const };
}

function bigrams(value: string) {
  const normalized = normalize(value);
  const set = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) set.add(normalized.slice(index, index + 2));
  return set;
}

function similarity(left: string, right: string) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return normalize(left) === normalize(right) ? 1 : 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

export function matchNccuCourse(name: string, credits: number | null, term: string) {
  const normalizedName = normalize(name);
  return (courseIndex as IndexCourse[]).map((course) => {
    const titleScore = normalizedName === normalize(course.title) ? 1 : Math.max(similarity(name, course.title), similarity(name, course.titleEn));
    const creditScore = credits == null || course.credits == null ? 0 : Number(course.credits) === Number(credits) ? 0.06 : -0.04;
    const termScore = term && course.offeredTerms.includes(term) ? 0.04 : 0;
    return { code: course.code, title: course.title, credits: course.credits, department: course.department, confidence: Math.min(0.99, Math.max(0, titleScore * 0.9 + creditScore + termScore)) };
  }).filter((candidate) => candidate.confidence >= 0.45).sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
