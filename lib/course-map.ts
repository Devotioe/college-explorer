type MapCourse = { id: string; school: string; code: string; title: string; prerequisites?: string; level?: string };
type TranscriptRow = { courseCode: string; courseName: string; gradeRaw: string; term: string };

export type CourseMapBranch<T> = {
  key: string;
  requirement: string;
  conditions?: string;
  courses: T[];
  status: "passed" | "recorded" | "no-record";
  relation: "official" | "related";
  topics?: string[];
};

export type CourseMapContinuation<T> = { course: T; reason: string } & (
  { relation: "official"; requirements: string[]; notes: string[] }
  | { relation: "extension" }
);

type CourseStatus = CourseMapBranch<MapCourse>["status"];
type Prerequisite = { title: string; duration: string; completion: string };
type Requirements = { groups: Prerequisite[][]; review: string[]; audience?: string };

const statusRank: Record<CourseStatus, number> = { "no-record": 0, recorded: 1, passed: 2 };
const unfinishedGrade = /^(?:W(?:退選|停修|撤選|WITHDRAWN)?|WITHDRAWN|WITHDRAWAL|退選|撤選|停修|棄修|已退選|I|IP|INCOMPLETE|INPROGRESS|PENDING|修課中|修習中|修讀中|選修中|在修|未修畢|未完成|成績未定|尚未登錄|未登錄|未評分|未送出|未公布|待補|待定|待登錄|NA)$/u;

const nccuDataStructuresCourses = new Set(["nccu-306013001", "nccu-703008001"]);
const nccuDataStructuresExtensions = [
  { id: "nccu-701788001", reason: "延伸資料結構中的演算法效率分析，練習拆解問題、選擇合適的資料結構並實作解法。" },
  { id: "nccu-781008001", reason: "從組織程式中的資料延伸到設計關聯式資料庫，練習資料建模、SQL、索引與查詢最佳化。" },
  { id: "nccu-703045001", reason: "把程式設計、資料結構與演算法用在實際專案，從規劃開始做出可運作的系統。" },
];

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

function parseNthuPrerequisites(text: string): Requirements {
  const header = /擋修對象\s*:\s*([\s\S]*?)\s*先修科目\s*:\s*([\s\S]*?)\s*,\s*則不擋修\s*[。.]?$/u
    .exec(text.split("｜")[0].normalize("NFKC"));
  if (!header) return { groups: [], review: text.includes("先修科目") ? ["先修條件格式有待人工確認"] : [] };
  const [, audience, rules] = header;
  const groups: Prerequisite[][] = [];
  const review: string[] = [];
  for (const block of rules.split(/,\s*而且\s*/u)) {
    const rule = /^([\s\S]*?)上述條件\s*(一定要有|任選一科)$/u.exec(block.trim());
    if (!rule) return { groups: [], review: ["先修條件格式有待人工確認"], audience };
    const alternatives: Prerequisite[] = [];
    const exclusions: string[] = [];
    for (let entry of rule[1].trim().split(/(?=曾修|未修過)/u)) {
      entry = entry.trim();
      if (!entry) continue;
      const recorded = /^(曾修|未修過)\s*([\s\S]+)$/u.exec(entry);
      if (recorded) {
        if (recorded[1] === "未修過") exclusions.push(recorded[2].trim());
        else alternatives.push({ title: recorded[2].trim(), duration: "單學期", completion: "曾修" });
        continue;
      }
      while (entry) {
        const grade = /^(.+?)[-−]\s*成績需\s*([A-F][+-]?)\s*以上/iu.exec(entry);
        if (!grade) return { groups: [], review: ["先修條件格式有待人工確認"], audience };
        alternatives.push({ title: grade[1].trim(), duration: "單學期", completion: `成績需 ${grade[2]} 以上` });
        entry = entry.slice(grade[0].length).trim();
      }
    }
    if (exclusions.length) review.push(`未修過條件（${rule[2]}）・${exclusions.join("、")}`);
    if (rule[2] === "一定要有") groups.push(...alternatives.map((item) => [item]));
    else if (alternatives.length && !exclusions.length) groups.push(alternatives);
    else if (alternatives.length) review.push("同一擇一組含曾修與未修過條件，請查閱校方原文");
  }
  return { groups, review, audience };
}

function courseRequirements(course: MapCourse): Requirements {
  const text = course.prerequisites?.trim() ?? "";
  if (course.school === "NTHU") return parseNthuPrerequisites(text);
  const groups = parsePrerequisites(text);
  return { groups, review: !groups.length && text && text !== "無先修設定" ? ["先修條件格式有待人工確認"] : [] };
}

export function getCourseRequirementNotes(course: MapCourse) {
  const { audience, review } = courseRequirements(course);
  return [...(audience && audience !== "全校" ? [`擋修適用對象・${audience}`] : []), ...review];
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
  return course.school === "NCCU" ? /^([1-9]\d{2})\d{6}$/u.exec(codeKey(course.code))?.[1]
    : /^([a-z]+)\d+$/u.exec(codeKey(course.code))?.[1];
}

function resolvePrerequisite<T extends MapCourse>(target: T, candidates: T[]) {
  const eligible = candidates.filter((course) => course.id !== target.id && codeKey(course.code) !== codeKey(target.code));
  const prefix = departmentPrefix(target);
  const sameDepartment = prefix ? eligible.filter((course) => departmentPrefix(course) === prefix) : [];
  const preferred = sameDepartment.length ? sameDepartment : eligible;
  return preferred.length === 1 ? preferred[0] : undefined;
}

function satisfiesRequirement(requirement: Prerequisite, status?: CourseStatus) {
  return requirement.duration === "單學期" && (status === "passed"
    || (status === "recorded" && requirement.completion === "有修即可"));
}

function officialBranches<T extends MapCourse>(target: T, catalog: readonly T[], requirements: Requirements, transcript: ReturnType<typeof indexTranscript<T>>): CourseMapBranch<T>[] {
  const byTitle = indexCourses(catalog.filter((course) => course.school === target.school), (course) => courseKey(course.title));
  const { groups, audience } = requirements;
  return groups.map((alternatives, index) => {
    const courses: T[] = [];
    let status: CourseStatus = "no-record";
    for (const requirement of alternatives) {
      const key = courseKey(requirement.title);
      const candidates = byTitle.get(key) ?? [];
      const linked = resolvePrerequisite(target, candidates);
      if (linked && !courses.some((course) => course.id === linked.id)) courses.push(linked);
      const known = linked ? transcript.resolved.get(linked.id) : undefined;
      const hasRecord = Boolean(known || (target.school === "NCCU" && transcript.unresolved.has(key)) || candidates.some((course) => transcript.resolved.has(course.id)));
      const next = satisfiesRequirement(requirement, known) ? "passed" : hasRecord ? "recorded" : "no-record";
      if (statusRank[next] > statusRank[status]) status = next;
    }
    return {
      key: `official-${index}`, requirement: alternatives.map(({ title }) => title).join(" 或 "),
      conditions: [describeConditions(alternatives), audience && audience !== "全校" ? `擋修對象・${audience}` : ""].filter(Boolean).join("｜"),
      courses, status, relation: "official",
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
  const requirements = courseRequirements(target);
  if (requirements.groups.length) return officialBranches(target, candidates, requirements, transcript);

  const targetTitle = courseKey(target.title);
  const related = candidates.filter((course) => courseKey(course.title) !== targetTitle
    && !(target.level === "大學部" && course.level === "研究所")).map((course) => ({
    course,
    status: transcript.resolved.get(course.id) ?? "no-record",
    topics: [...new Set(sharedDomains(target, course).filter(Boolean))],
  })).filter(({ topics }) => topics.length > 0).sort((a, b) =>
    statusRank[b.status] - statusRank[a.status] || b.topics.length - a.topics.length
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
    const otherSchool = ranked.find(({ course, topics }) => course.school !== last.course.school && topics.length >= Math.max(2, last.topics.length));
    if (otherSchool) shown[3] = otherSchool;
  }
  return shown.map(({ course, status, topics }) => ({ key: `related-${course.id}`, requirement: course.title, courses: [course], status, relation: "related", topics }));
}

export function buildCourseMapContinuations<T extends MapCourse>(selected: T, catalog: readonly T[]): CourseMapContinuation<T>[] {
  const sameSchool = new Map(catalog.filter((course) => course.school === selected.school).map((course) => [course.id, course]));
  sameSchool.set(selected.id, selected);
  const selectedTitle = courseKey(selected.title);
  const sameTitle = [...sameSchool.values()].filter((course) => courseKey(course.title) === selectedTitle);
  const official: CourseMapContinuation<T>[] = [];

  for (const course of sameSchool.values()) {
    if (course.id === selected.id || codeKey(course.code) === codeKey(selected.code)) continue;
    const { groups } = courseRequirements(course);
    const matching = groups.filter((group) => group.some(({ title }) => courseKey(title) === selectedTitle));
    if (!matching.length || resolvePrerequisite(course, sameTitle)?.id !== selected.id) continue;

    official.push({
      course, relation: "official",
      reason: matching.some((group) => group.length === 1) ? `校方把「${selected.title}」列為先修。` : `「${selected.title}」是校方列出的擇一先修選項。`,
      requirements: groups.map((group) => group.map(({ title, duration, completion }) => `${title}（${duration}・${completion}）`).join(" 或 ")),
      notes: getCourseRequirementNotes(course),
    });
  }

  official.sort((a, b) => a.course.title.localeCompare(b.course.title, "zh-Hant") || a.course.id.localeCompare(b.course.id, "en"));
  if (!nccuDataStructuresCourses.has(selected.id)) return official;

  const officialIds = new Set(official.map(({ course }) => course.id));
  const extensions = nccuDataStructuresExtensions.flatMap(({ id, reason }): CourseMapContinuation<T>[] => {
    const course = sameSchool.get(id);
    return course && !officialIds.has(id) ? [{ course, relation: "extension", reason }] : [];
  });
  return [...official, ...extensions];
}

export type SemesterPlanEdge = { from: string; to: string; alternative: boolean };

export function buildSemesterPlan<T extends MapCourse>(
  targets: readonly T[], catalog: readonly T[], completed: readonly TranscriptRow[], suggestedSemesters?: ReadonlyMap<string, number>,
) {
  const unique = [...new Map([...catalog, ...targets].map((course) => [course.id, course])).values()];
  const transcript = indexTranscript(unique, completed).resolved;
  const bySchoolAndTitle = indexCourses(unique, (course) => `${course.school}:${courseKey(course.title)}`);
  type Group = { label: string; choices: T[]; satisfied: boolean; alternative: boolean };
  type Node = { course: T; groups: Group[]; notes: string[]; pending: boolean; semester: number };
  const graph = new Map<string, Node>();
  const complete = new Set<string>();
  const targetIds = new Set(targets.map(({ id }) => id));

  function collect(course: T) {
    if (graph.has(course.id)) return;
    const requirements = courseRequirements(course);
    const groups = requirements.groups.map((alternatives): Group => {
      const label = alternatives.map(({ title, duration }) => duration === "全學年" ? `${title}（全學年）` : title).join(" 或 ");
      const alternative = alternatives.length > 1;
      const choices: T[] = [];
      for (const requirement of alternatives) {
        if (requirement.duration !== "單學期") continue;
        const linked = resolvePrerequisite(course, bySchoolAndTitle.get(`${course.school}:${courseKey(requirement.title)}`) ?? []);
        if (!linked) continue;
        if (satisfiesRequirement(requirement, transcript.get(linked.id))) return { label, choices: [], satisfied: true, alternative };
        choices.push(linked);
      }
      return { label, choices, satisfied: false, alternative };
    });
    graph.set(course.id, {
      course, groups, notes: getCourseRequirementNotes(course),
      pending: requirements.review.some((note) => note.includes("格式") || note.includes("同一擇一組")),
      semester: Infinity,
    });
    for (const group of groups) group.choices.forEach(collect);
  }

  for (const course of targets) {
    if (transcript.get(course.id) === "passed") complete.add(course.id);
    else collect(course);
  }

  function earliestChoice(group: Group) {
    return group.choices.reduce<Node | undefined>((best, candidate) => {
      const next = graph.get(candidate.id)!;
      return next.semester < (best?.semester ?? Infinity) ? next : best;
    }, undefined);
  }

  // Each pass gives a course a term only when every group has an earlier
  // eligible option. A cycle without an external alternative stays unresolved.
  for (let pass = 0; pass < graph.size; pass += 1) {
    let changed = false;
    for (const node of graph.values()) {
      if (node.pending) continue;
      const prerequisites = node.groups.filter(({ satisfied }) => !satisfied);
      const afterPrerequisites = 1 + Math.max(0, ...prerequisites.map((group) => earliestChoice(group)?.semester ?? Infinity));
      const semester = Math.max(suggestedSemesters?.get(node.course.id) ?? 1, afterPrerequisites);
      if (semester < node.semester) {
        node.semester = semester;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const visited = new Set<string>();
  const notes = new Set<string>();
  const semesters = new Map<number, { course: T; target: boolean }[]>();
  const edges = new Map<string, SemesterPlanEdge>();
  function include(node: Node, visiting: ReadonlySet<string>) {
    const { course, semester } = node;
    if (visiting.has(course.id)) {
      notes.add(`${course.title}・先修條件出現循環`);
      return;
    }
    if (visited.has(course.id)) return;
    visited.add(course.id);
    const path = new Set([...visiting, course.id]);
    if (Number.isFinite(semester)) {
      const entries = semesters.get(semester) ?? [];
      entries.push({ course, target: targetIds.has(course.id) });
      semesters.set(semester, entries);
    }
    for (const note of node.notes) notes.add(`${course.title}・${note}`);
    for (const group of node.groups) {
      if (group.satisfied) continue;
      const choice = earliestChoice(group);
      if (choice) {
        if (Number.isFinite(semester) && choice.semester < semester) {
          const key = `${choice.course.id}:${course.id}`;
          if (edges.get(key)?.alternative !== false) edges.set(key, { from: choice.course.id, to: course.id, alternative: group.alternative });
        }
        include(choice, path);
      } else {
        notes.add(`${course.title}・待確認先修「${group.label}」`);
        if (group.choices.length === 1) include(graph.get(group.choices[0].id)!, path);
      }
    }
  }
  for (const course of targets) {
    const node = graph.get(course.id);
    if (node) include(node, new Set());
  }
  return { semesters: [...semesters].sort(([a], [b]) => a - b), edges: [...edges.values()], complete, notes: [...notes] };
}
