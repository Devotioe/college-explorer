import { normalizeNccuCourseCode } from "./nccu-course-code.mjs";

// Query aliases describe an intent. Course aliases may also identify a skill
// that supports that intent, even when the intended project is not mentioned.
const concepts = [
  { topic: "行動應用開發", query: ["app", "手機應用", "行動應用", "應用程式", "mobile app", "android", "ios"], related: ["程式設計", "軟體開發", "人機互動", "programming", "software development"] },
  { topic: "程式與軟體", query: ["寫程式", "程式設計", "軟體工程", "coding", "programming", "software engineering"], related: ["資料結構", "演算法", "python", "javascript", "軟體開發"] },
  { topic: "資料分析", query: ["資料分析", "數據分析", "資料科學", "資料視覺化", "data analytics", "data analysis", "data science"], related: ["統計學", "量化方法", "資料探勘", "資料採掘", "statistics", "data mining"] },
  { topic: "人工智慧", query: ["ai", "人工智慧", "機器學習", "深度學習", "machine learning", "deep learning", "artificial intelligence"], related: ["神經網路", "自然語言處理", "neural networks", "natural language processing"] },
  { topic: "資料治理", query: ["資料治理", "資料保護", "資料隱私", "data governance", "data privacy", "個資"], related: ["資訊倫理", "資訊政策", "隱私權", "個人資料保護", "資料管理"] },
  { topic: "環境與永續", query: ["永續", "氣候變遷", "淨零", "esg", "sustainability", "climate change"], related: ["環境治理", "環境政策", "碳排放", "再生能源", "碳盤查"] },
  { topic: "政策、法律與治理", query: ["公共政策", "公共議題", "政策分析", "科技法律", "public policy", "policy analysis"], related: ["公共行政", "政策評估", "公共治理", "法規"] },
  { topic: "互動設計", query: ["使用者體驗", "介面設計", "互動設計", "人機互動", "ux", "user experience"], related: ["設計思考", "使用者研究", "原型設計", "human computer interaction"] },
  { topic: "資訊安全", query: ["資安", "資訊安全", "網路安全", "cybersecurity", "information security"], related: ["密碼學", "網路防禦", "cryptography"] },
  { topic: "金融與投資", query: ["理財", "投資", "金融", "finance", "investment"], related: ["財務管理", "資產定價", "金融市場", "投資組合"] },
] as const;

type SearchCourse = {
  id: string; code: string; titleZh: string; titleEn: string; department: string;
  topics: string[]; description?: string | null; objectives?: string | null; syllabusUrl?: string | null; school: string;
};
type Source = "課名" | "課號" | "開課單位" | "課程標籤" | "課程簡介" | "課程目標／大綱";
type SearchField = { source: Source; value: string; normalized: string; weight: number };
type Evidence = { topic?: string; queryTerm: string; matchedTerm: string; source: Source; excerpt: string; related: boolean };
export type CourseRecommendation = { id: string; evidence: Evidence[]; syllabusUrl?: string };

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function indexOfTerm(text: string, term: string): number {
  const wholeWord = /^[a-z\d ]+$/u.test(term);
  let at = text.indexOf(term);
  while (at >= 0) {
    if (!wholeWord || !(/[a-z0-9]/u.test(text[at - 1] ?? "") || /[a-z0-9]/u.test(text[at + term.length] ?? ""))) return at;
    at = text.indexOf(term, at + term.length);
  }
  return -1;
}

export function indexRecommendationCourses<T extends SearchCourse>(courses: readonly T[]) {
  return courses.map((course) => {
    const sources: [Source, string | null | undefined, number][] = [
      ["課名", course.titleZh, 9], ["課名", course.titleEn, 9],
      ["課程簡介", course.description, 5], ["課程目標／大綱", course.objectives, 4],
      ...course.topics.map((topic): [Source, string, number] => ["課程標籤", topic, 3]),
      ["開課單位", course.department, 2],
    ];
    const fields = sources.flatMap(([source, value, weight]): SearchField[] => value?.trim()
      ? [{ source, value: value.normalize("NFKC").replace(/\s+/gu, " ").trim(), normalized: normalize(value), weight }]
      : []);
    return { course, fields };
  });
}

function matchEvidence(field: SearchField, term: string, at: number, queryTerm: string, related: boolean, topic?: string): Evidence {
  const start = Math.max(0, at - 28);
  const end = Math.min(field.value.length, at + term.length + 58);
  return {
    topic, queryTerm, matchedTerm: field.value.slice(at, at + term.length), source: field.source, related,
    excerpt: `${start ? "…" : ""}${field.value.slice(start, end)}${end < field.value.length ? "…" : ""}`,
  };
}

function match(fields: SearchField[], terms: readonly string[], queryTerm: string, related: boolean, topic?: string) {
  for (const field of fields) {
    for (const term of terms) {
      const at = field.source === "課程標籤" ? (field.normalized === term ? 0 : -1) : indexOfTerm(field.normalized, term);
      if (at >= 0) return {
        score: field.weight * (related ? 0.55 : 1),
        evidence: matchEvidence(field, term, at, queryTerm, related, topic),
      };
    }
  }
}

const queryFiller = /(?:請推薦|可以推薦|有沒有|我想要?|希望可以|希望|請問|想找|想學|想做|初學者|從零開始|入門|相關的?|的課程?|課程|大學部|研究所|英文授課|英語授課|中文授課|清大|政大)/gu;

export function recommendCourses<T extends SearchCourse>(
  input: string,
  index: ReturnType<typeof indexRecommendationCourses<T>>,
  offeringIds: readonly string[] = [],
) {
  const query = normalize(input);
  if (!query) return [];
  const code = query.replace(/[\s-]+/gu, "");
  const offeringMatches = new Set(offeringIds);
  const codeQuery = Boolean(normalizeNccuCourseCode(query) || /^[a-z]{1,6}\d{4,8}$/u.test(code));
  const intents = concepts.flatMap((concept) => {
    const term = concept.query.find((alias) => indexOfTerm(query, alias) >= 0);
    return term ? [{ concept, term }] : [];
  });
  const core = query.replace(queryFiller, " ").replace(/\b(?:i want to|learn|courses? about|intro to|beginner)\b/gu, " ").trim();
  const terms = [...new Set([query, core, ...core.split(/[\s、，。；！？,;!?]|(?:以及|而且|還有|和|與)/gu)].map((term) => term.trim()))]
    .filter((term) => term.length >= 2).slice(0, 10);
  const ranked = index.flatMap(({ course, fields }) => {
    const isCode = normalize(course.code).replace(/[\s-]+/gu, "") === code || offeringMatches.has(course.id);
    if (isCode) return [{ course, score: 100, evidence: [{ source: "課號" as const, queryTerm: input, matchedTerm: code, excerpt: offeringMatches.has(course.id) ? input : course.code, related: false }] as Evidence[] }];
    if (codeQuery) return [];
    const matched = intents.flatMap(({ concept, term }) => {
      const direct = match(fields, concept.query, term, false, concept.topic);
      const association = direct ?? match(fields, concept.related, term, true, concept.topic);
      return association ? [association] : [];
    });
    const literal = match(fields, terms, query, false);
    if (!matched.length && !literal) return [];
    const evidence = matched.map((part) => part.evidence);
    if (literal && (!evidence.length || literal.score > Math.max(...matched.map((part) => part.score)))) evidence.push(literal.evidence);
    const sourceEvidence = match(fields.filter(({ source }) => source === "課程簡介" || source === "課程目標／大綱"), [
      ...terms, ...intents.flatMap(({ concept }) => [...concept.query, ...concept.related]),
    ], query, false);
    if (sourceEvidence && evidence.every(({ source }) => source !== "課程簡介" && source !== "課程目標／大綱")) {
      evidence.push(sourceEvidence.evidence);
    }
    const score = matched.reduce((total, part) => total + part.score + 3, 0) + (literal?.score ?? 0);
    return [{ course, score, evidence }];
  });
  return ranked.sort((left, right) => right.score - left.score
    || left.course.titleZh.localeCompare(right.course.titleZh, "zh-Hant") || left.course.id.localeCompare(right.course.id))
    .map(({ course, evidence }): CourseRecommendation => ({
      id: course.id, evidence: evidence.slice(0, 5), ...(course.syllabusUrl ? { syllabusUrl: course.syllabusUrl } : {}),
    }));
}
