import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const evidenceRank = { article: 3, archived_summary: 2, archived_comment: 1 };
const detailFields = ["teaching", "workload", "assessment", "studentAdvice"];

function normalizeReviewDetails(raw) {
  const details = {};
  for (const field of detailFields) {
    const value = raw?.[field];
    if (typeof value === "string" && value.trim()) details[field] = value.trim().replace(/\s+/g, " ");
  }
  return Object.keys(details).length ? details : undefined;
}

function normalize(value = "") {
  return value.normalize("NFKC").toLowerCase().replaceAll("台", "臺").replace(/[\s\p{P}\p{S}]/gu, "");
}

function normalizeTerm(value = "") {
  return value.normalize("NFKC").trim().replace(/[‐‑–—−]/g, "-").replace(/\s/g, "");
}

function departmentKey(value) {
  return normalize(value).replaceAll("資訊管理", "資管").replace(/資訊科學|資科/g, "資訊");
}

function teacherNames(value = "") {
  return [...new Set(value.normalize("NFKC").split(/[,、;；\/\n]/).map((name) => name.trim()).filter(Boolean))]
    .sort((a, b) => normalize(a) < normalize(b) ? -1 : normalize(a) > normalize(b) ? 1 : 0);
}

export function canonicalizeDcardUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !["dcard.tw", "www.dcard.tw"].includes(parsed.hostname)) return null;
    const match = /^\/f\/nccu\/p\/([1-9]\d*)(?:\/b\/\d+)?\/?$/.exec(parsed.pathname);
    if (!match) return null;
    const postId = match[1];
    return { url: `https://www.dcard.tw/f/nccu/p/${postId}`, postId };
  } catch {
    return null;
  }
}

export function buildCatalogIndex(records, historicalInstructors = []) {
  const byTitle = new Map();
  const byCode = new Map();
  const historicalByCode = Map.groupBy(historicalInstructors, (row) => normalize(row.code));
  for (const { course, offerings } of records) {
    if (course.school !== "NCCU") continue;
    const code = normalize(course.code);
    const key = normalize(course.titleZh);
    const historical = (historicalByCode.get(code) ?? []).filter((row) => !row.course || normalize(row.course) === key);
    const historicalTerms = new Map();
    for (const row of historical) {
      const term = normalizeTerm(row.semester);
      if (!historicalTerms.has(term)) historicalTerms.set(term, new Set());
      historicalTerms.get(term).add(normalize(row.name));
    }
    const entry = {
      ...course,
      departments: new Set([course.department, ...historical.map((row) => row.department)].filter(Boolean).map(departmentKey)),
      teachers: new Set([
        ...offerings.flatMap((offering) => teacherNames(offering.teacher)),
        ...historical.map((row) => row.name),
      ].map(normalize)),
      historicalTerms,
      terms: new Set([...course.offeredTerms, ...historicalTerms.keys()].map(normalizeTerm)),
    };
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(entry);
    byCode.set(code, entry);
  }
  return { byCode, byTitle };
}

export function classifyReview(input, index, withdrawn = new Set()) {
  const source = canonicalizeDcardUrl(input.url);
  const record = {
    url: source?.url ?? input.url,
    postId: source?.postId ?? String(input.postId ?? ""),
    course: input.course ?? "",
    teacher: teacherNames(input.teacher).join("、"),
    semester: normalizeTerm(input.semester),
    department: input.department ?? "",
    sourceEvidence: input.sourceEvidence,
  };
  const classify = (verificationStatus, reason) => ({ ...record, verificationStatus, reason });
  if (!source) return classify("rejected", "non_nccu_board_or_invalid_url");
  if (withdrawn.has(source.url)) return classify("rejected", "withdrawn_source");
  if (input.postId && String(input.postId) !== source.postId) return classify("rejected", "post_id_mismatch");
  const summary = input.summary?.trim().replace(/\s+/g, " ") ?? "";
  if (!Object.hasOwn(evidenceRank, input.sourceEvidence) || summary.length < 12 || summary.length > 220) return classify("quarantine", "insufficient_content");
  const isPublicArticle = input.sourceEvidence === "article";
  if (isPublicArticle ? !input.sourceTitle?.trim() : !input.archiveSourceVerified) {
    return classify("quarantine", "source_not_verified");
  }
  if (!record.teacher) return classify("quarantine", "teacher_missing");
  if (record.semester && !/^\d{2,3}-[12]$/.test(record.semester)) return classify("quarantine", "invalid_semester");

  const titleKey = normalize(record.course);
  const matchingCode = input.courseCode ? index.byCode.get(normalize(input.courseCode)) : null;
  const courses = input.courseCode
    ? (matchingCode && normalize(matchingCode.titleZh) === titleKey ? [matchingCode] : [])
    : (index.byTitle.get(titleKey) ?? []);
  if (!courses.length) return classify("quarantine", "course_not_found");
  const inTerm = courses.filter((course) => !record.semester || course.terms.has(record.semester));
  if (!inTerm.length) return classify("quarantine", "semester_not_verified");
  // The public article supplies its own reported semester. Archived excerpts
  // require the original term's roster when they claim a specific semester.
  const withTermEvidence = record.semester && !isPublicArticle
    ? inTerm.filter((course) => course.historicalTerms.has(record.semester))
    : inTerm;
  if (!withTermEvidence.length) return classify("quarantine", "teacher_term_not_verified");
  const names = teacherNames(record.teacher).map(normalize);
  const taughtBy = withTermEvidence.filter((course) => {
    const teachers = course.historicalTerms.get(record.semester) ?? course.teachers;
    return names.every((name) => teachers.has(name));
  });
  if (!taughtBy.length) return classify("quarantine", "teacher_not_verified");
  const department = departmentKey(record.department);
  const candidates = department ? taughtBy.filter((course) => [...course.departments].some((name) =>
    name === department || (department.endsWith("系") && name.startsWith(department.slice(0, -1))),
  )) : taughtBy;
  if (!candidates.length) return classify("quarantine", "department_mismatch");
  if (candidates.length !== 1) return classify("quarantine", "ambiguous_course");

  const course = candidates[0];
  const identity = JSON.stringify([course.id, source.postId, names, record.semester]);
  const details = normalizeReviewDetails(input.details);
  return {
    ...record,
    id: createHash("sha256").update(identity).digest("hex").slice(0, 24),
    courseId: course.id,
    course: course.titleZh,
    department: course.department,
    summary,
    ...(details ? { details } : {}),
    verificationStatus: "published",
  };
}

export function processReviews(inputs, index, withdrawn = new Set()) {
  const result = { published: [], quarantine: [], rejected: [] };
  const articleRows = inputs.filter((input) => input.sourceEvidence !== "candidate");
  const ranked = articleRows.toSorted((a, b) => (evidenceRank[b.sourceEvidence] ?? 0) - (evidenceRank[a.sourceEvidence] ?? 0));
  const seen = new Set();
  const sourcedPosts = new Set();
  for (const input of ranked) {
    const row = classifyReview(input, index, withdrawn);
    if (row.postId) sourcedPosts.add(row.postId);
    if (row.verificationStatus !== "published") {
      result[row.verificationStatus].push(row);
    } else if (seen.has(row.id)) {
      result.rejected.push({ postId: row.postId, courseId: row.courseId, verificationStatus: "rejected", reason: "duplicate_post_review" });
    } else {
      seen.add(row.id);
      result.published.push(row);
    }
  }

  const seenCandidates = new Set();
  for (const input of inputs.filter((row) => row.sourceEvidence === "candidate")) {
    const row = classifyReview(input, index, withdrawn);
    if (row.verificationStatus === "rejected") {
      result.rejected.push(row);
    } else if (sourcedPosts.has(row.postId) || seenCandidates.has(row.postId)) {
      result.rejected.push({ ...row, verificationStatus: "rejected", reason: "duplicate_post_candidate" });
    } else {
      seenCandidates.add(row.postId);
      result.quarantine.push(row);
    }
  }
  result.published.sort((a, b) => b.semester.localeCompare(a.semester, "en", { numeric: true })
    || Number(b.postId) - Number(a.postId) || a.id.localeCompare(b.id));
  return result;
}

async function run() {
  const directory = new URL("../data/dcard/", import.meta.url);
  const seed = JSON.parse(await readFile(new URL("../data/course-seed.json", import.meta.url), "utf8"));
  const readOptionalReviews = async (filename) => JSON.parse(await readFile(new URL(filename, directory), "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return "[]";
  }));
  const [publicSources, archiveDetails] = await Promise.all([
    readOptionalReviews("new-public-sources.json"),
    readOptionalReviews("archive-review-details.json"),
  ]);
  const db = new DatabaseSync(new URL("collector.sqlite3", directory), { readOnly: true });
  const reviewers = db.prepare(`
    WITH review_rows AS (
      SELECT department, course, teacher, semester, review, post_id, url, source_kind FROM teacher_reviews
      UNION ALL
      SELECT department, course, teacher, semester, review, post_id, url, source_kind FROM course_reviews
    )
    SELECT r.department, r.course, r.teacher, r.semester, r.review AS summary,
      r.post_id AS postId, r.url, r.source_kind AS sourceKind,
      EXISTS (
        SELECT 1 FROM sources s
        WHERE s.url = r.url AND s.post_id = r.post_id AND s.source_kind = r.source_kind
          AND length(trim(s.body)) >= 12
      ) AS archiveSourceVerified
    FROM review_rows r
  `).all().map((row) => ({
    ...row,
    sourceEvidence: row.sourceKind === "留言摘要" ? "archived_comment" : "archived_summary",
  }));
  const candidates = db.prepare("SELECT url, post_id AS postId FROM candidates ORDER BY url").all()
    .map((row) => ({ ...row, sourceEvidence: "candidate" }));
  const withdrawn = new Set(db.prepare("SELECT url FROM withdrawn").all()
    .map((row) => canonicalizeDcardUrl(row.url)?.url).filter(Boolean));
  const index = buildCatalogIndex(seed.records, db.prepare(`
    SELECT i.semester, i.code, i.name, i.department, c.course
    FROM course_instructors i LEFT JOIN catalog c ON c.semester = i.semester AND c.code = i.code
  `).all());
  db.close();

  const inputs = [...publicSources, ...reviewers, ...candidates];
  const result = processReviews(inputs, index, withdrawn);
  const archiveDetailsById = new Map(archiveDetails.map(({ id, details }) => [id, normalizeReviewDetails(details)]));
  for (const row of result.published) {
    const details = archiveDetailsById.get(row.id);
    if (row.sourceEvidence !== "article" && details) row.details = details;
  }
  const output = new URL("processed/", directory);
  await mkdir(output, { recursive: true });
  for (const [status, rows] of Object.entries(result)) {
    await writeFile(new URL(`${status}.json`, output), `${JSON.stringify(rows, null, 2)}\n`);
  }
  const summarize = (rows) => ({
    reviews: rows.length,
    detailedReviews: rows.filter((row) => row.details).length,
    posts: new Set(rows.map((row) => row.postId)).size,
    courses: new Set(rows.map((row) => row.courseId)).size,
    teacherNames: new Set(rows.flatMap((row) => teacherNames(row.teacher))).size,
    openingUnits: [...new Set(rows.map((row) => row.department))].sort(),
  });
  const reasonCounts = Object.fromEntries([...Map.groupBy([...result.quarantine, ...result.rejected], (row) => row.reason)]
    .map(([reason, rows]) => [reason, rows.length]));
  const catalogCourses = index.byCode.size;
  const duplicateRows = (reasonCounts.duplicate_post_candidate ?? 0) + (reasonCounts.duplicate_post_review ?? 0);
  const report = {
    input: { legacyReviews: reviewers.length, curatedReviews: publicSources.length, candidateRows: candidates.length, catalogCourses },
    published: summarize(result.published),
    publicArticles: summarize(result.published.filter((row) => row.sourceEvidence === "article")),
    quarantine: result.quarantine.length,
    rejected: result.rejected.length,
    duplicateRows,
    duplicateRate: inputs.length ? duplicateRows / inputs.length : 0,
    reasonCounts,
  };
  await writeFile(new URL("quality-report.json", output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
