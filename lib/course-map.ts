type MapCourse = { id: string; school: string; code: string; title: string; prerequisites?: string; level?: string };
type TranscriptRow = { courseCode: string; courseName: string; gradeRaw: string; term: string };

export type CourseMapBranch<T> = {
  key: string;
  requirement: string;
  conditions?: string;
  courses: T[];
  status: "passed" | "recorded" | "no-record";
  relation: "official" | "related";
};

type CourseStatus = CourseMapBranch<MapCourse>["status"];
type Prerequisite = { title: string; duration: string; completion: string };

const statusRank: Record<CourseStatus, number> = { "no-record": 0, recorded: 1, passed: 2 };
const unfinishedGrade = /^(?:W(?:退選|停修|撤選|WITHDRAWN)?|WITHDRAWN|WITHDRAWAL|退選|撤選|停修|棄修|已退選|I|IP|INCOMPLETE|INPROGRESS|PENDING|修課中|修習中|修讀中|選修中|在修|未修畢|未完成|成績未定|尚未登錄|未登錄|未評分|未送出|未公布|待補|待定|待登錄|NA)$/u;

function courseKey(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "").replace(/[‐‑–—−─]/gu, "-");
}

function codeKey(value: string) {
  return courseKey(value).replaceAll("-", "");
}

function subjectCode(code: string) {
  return /^[a-z\d]{6}(?:\d{3})?$/u.test(code) ? code.slice(0, 6) : "";
}

function parsePrerequisites(prerequisites: string): Prerequisite[][] {
  const text = prerequisites.replaceAll("［", "[").replaceAll("］", "]").trim();
  if (!/^\[[^[\]]+\](?:\s*及\s*\[[^[\]]+\])*$/u.test(text)) return [];
  const groups = Array.from(text.matchAll(/\[([^\]]+)\]/gu), ([, group]) => group);
  const parsed: Prerequisite[][] = [];
  for (const group of groups) {
    const alternatives: Prerequisite[] = [];
    for (const item of group.split(/(?<=[)）])\s*或\s*|\s+或\s+/u)) {
      const match = /^(.+?)\s*[（(](單學期|全學年)[）)]\s*[（(](修習且及格|有修即可)[）)]$/u.exec(item.trim());
      if (!match) return [];
      alternatives.push({ title: match[1], duration: match[2], completion: match[3] });
    }
    parsed.push(alternatives);
  }
  return parsed;
}

function describeConditions(alternatives: Prerequisite[]) {
  const conditions = alternatives.map(({ duration, completion }) => `${duration}・${completion}`);
  if (alternatives.length === 1) return conditions[0];
  if (new Set(conditions).size === 1) return `任一門・${conditions[0]}`;
  return `任一門：${alternatives.map(({ title }, index) => `${title}（${conditions[index]}）`).join("或")}`;
}

function transcriptStatus(grade: string, course: MapCourse): CourseStatus {
  if (/^(?:P|PASS(?:ED)?|及格|通過|抵免)$/iu.test(grade)) return "passed";
  if (course.level === "大學部" && /^\d{1,3}(?:\.\d+)?$/u.test(grade)) {
    const score = Number(grade);
    if (score >= 60 && score <= 100) return "passed";
  }
  return "recorded";
}

function indexCourses<T extends MapCourse>(courses: readonly T[], getKey: (course: T) => string) {
  const index = new Map<string, T[]>();
  for (const course of courses) {
    const key = getKey(course);
    if (!key) continue;
    const entries = index.get(key) ?? [];
    entries.push(course);
    index.set(key, entries);
  }
  return index;
}

function indexTranscript<T extends MapCourse>(catalog: readonly T[], completed: readonly TranscriptRow[]) {
  const resolved = new Map<string, CourseStatus>();
  const unresolved = new Set<string>();
  if (!completed.length) return { resolved, unresolved };
  const nccu = catalog.filter((course) => course.school === "NCCU");
  const byCode = indexCourses(nccu, (course) => codeKey(course.code));
  const bySubject = indexCourses(nccu, (course) => subjectCode(codeKey(course.code)));
  const byTitle = indexCourses(nccu, (course) => courseKey(course.title));
  for (const row of completed) {
    const grade = row.gradeRaw.normalize("NFKC").trim();
    const gradeStatus = grade.toUpperCase().replace(/[\s\p{P}\p{S}]/gu, "");
    if (!gradeStatus || unfinishedGrade.test(gradeStatus)) continue;
    const title = courseKey(row.courseName);
    const code = codeKey(row.courseCode);
    const codedCourses = code ? byCode.get(code) ?? bySubject.get(subjectCode(code)) ?? [] : [];
    // A code associated with a different title is conflicting evidence, including OCR guesses.
    const candidates = code ? codedCourses.filter((course) => !title || courseKey(course.title) === title) : byTitle.get(title) ?? [];
    if (candidates.length === 1) {
      const course = candidates[0];
      const status = transcriptStatus(grade, course);
      if (statusRank[status] > statusRank[resolved.get(course.id) ?? "no-record"]) resolved.set(course.id, status);
    } else if (title && (candidates.length > 1 || !codedCourses.length)) {
      unresolved.add(title);
    }
  }
  return { resolved, unresolved };
}

function departmentPrefix(course: MapCourse) {
  return course.school === "NCCU" ? /^([1-9]\d{2})\d{6}$/u.exec(codeKey(course.code))?.[1] : undefined;
}

function officialBranches<T extends MapCourse>(target: T, catalog: readonly T[], groups: Prerequisite[][], transcript: ReturnType<typeof indexTranscript<T>>): CourseMapBranch<T>[] {
  const byTitle = indexCourses(catalog.filter((course) => course.school === target.school), (course) => courseKey(course.title));
  const prefix = departmentPrefix(target);
  return groups.map((alternatives, index) => {
    const courses: T[] = [];
    let status: CourseStatus = "no-record";
    for (const { title, duration } of alternatives) {
      const key = courseKey(title);
      const candidates = byTitle.get(key) ?? [];
      const sameDepartment = prefix ? candidates.filter((course) => departmentPrefix(course) === prefix) : [];
      const preferred = sameDepartment.length ? sameDepartment : candidates;
      // Transcript evidence can describe an attempt but cannot identify an ambiguous requirement.
      const linked = preferred.length === 1 ? preferred[0] : null;
      if (linked && !courses.some((course) => course.id === linked.id)) courses.push(linked);
      const known = linked ? transcript.resolved.get(linked.id) : undefined;
      const hasRecord = Boolean(known || (target.school === "NCCU" && transcript.unresolved.has(key)) || candidates.some((course) => transcript.resolved.has(course.id)));
      const next = known === "passed" && duration === "單學期" ? "passed" : hasRecord ? "recorded" : "no-record";
      if (statusRank[next] > statusRank[status]) status = next;
    }
    return {
      key: `official-${index}`, requirement: alternatives.map(({ title }) => title).join(" 或 "),
      conditions: describeConditions(alternatives), courses, status, relation: "official",
    };
  });
}

export function buildCourseMapBranches<T extends MapCourse>(
  target: T,
  catalog: readonly T[],
  completed: readonly TranscriptRow[],
  sharedDomains: (left: T, right: T) => string[],
): CourseMapBranch<T>[] {
  const uniqueCatalog = [...new Map(catalog.map((course) => [course.id, course])).values()];
  const targetCode = codeKey(target.code);
  const candidates = uniqueCatalog.filter((course) => course.id !== target.id && (!targetCode || course.school !== target.school || codeKey(course.code) !== targetCode));
  const transcript = indexTranscript(uniqueCatalog, completed);
  const requirements = parsePrerequisites(target.prerequisites ?? "");
  if (requirements.length) return officialBranches(target, candidates, requirements, transcript);

  const targetTitle = courseKey(target.title);
  const related = candidates.filter((course) => courseKey(course.title) !== targetTitle
    && !(target.level === "大學部" && course.level === "研究所")).map((course) => ({
    course,
    status: transcript.resolved.get(course.id) ?? "no-record",
    overlap: new Set(sharedDomains(target, course).filter(Boolean)).size,
  })).filter(({ overlap }) => overlap > 0).sort((a, b) =>
    statusRank[b.status] - statusRank[a.status] || b.overlap - a.overlap
    || Number(b.course.school === target.school) - Number(a.course.school === target.school)
    || a.course.id.localeCompare(b.course.id, "en"),
  );
  const distinct = new Set<string>();
  const ranked = related.filter(({ course }) => {
    const key = `${course.school}:${courseKey(course.title)}`;
    if (distinct.has(key)) return false;
    distinct.add(key);
    return true;
  });
  const shown = ranked.slice(0, 4);
  const last = shown.at(-1);
  if (shown.length === 4 && last?.status === "no-record" && shown.every(({ course }) => course.school === last.course.school)) {
    const otherSchool = ranked.find(({ course, overlap }) => course.school !== last.course.school && overlap >= Math.max(2, last.overlap));
    if (otherSchool) shown[3] = otherSchool;
  }
  return shown.map(({ course, status }) => ({ key: `related-${course.id}`, requirement: course.title, courses: [course], status, relation: "related" }));
}
