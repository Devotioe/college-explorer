import courseIndex from "../data/nccu-course-index.json";

type IndexCourse = (typeof courseIndex)[number];
export type TranscriptCandidate = Pick<IndexCourse, "code" | "title" | "credits" | "department"> & { confidence: number };

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
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
