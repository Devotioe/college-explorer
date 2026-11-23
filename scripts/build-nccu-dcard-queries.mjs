import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const board = "site:dcard.tw/f/nccu/p/";
const reviewPhrases = ["修課心得", "選課心得", "課程心得"];
const queryKinds = ["yearly_review", "department", "course", "teacher_course"];
const teacherPlaceholder = /^(?:無|未定|未排定|未公布|待定|待聘|待確認|教師待確認|教師未定|授課教師未定|詳備註|詳見備註|NA|TBD|[-—–?]+)$/iu;
const teacherSeparators = /\bN\s*\/\s*A\b|[,、;\/|\r\n]+/giu;

function cleanText(text) {
  return typeof text === "string" ? text.normalize("NFKC").trim().replace(/\s+/gu, " ") : "";
}

function termsFromLabel(text, separators) {
  return typeof text === "string" ? text.normalize("NFKC").split(separators).map(cleanText).filter(Boolean) : [];
}

function searchPhrase(term) {
  return `"${cleanText(term.replace(/"/gu, " "))}"`;
}

function termYear(term) {
  const match = /^(\d{2,3})\s*-\s*([12])$/u.exec(cleanText(term));
  if (!match) return null;
  // The second semester starts in the calendar year following the ROC academic year.
  return Number(match[1]) + 1911 + (match[2] === "2" ? 1 : 0);
}

export function buildNccuSearchQueries(records) {
  const queries = new Map();
  const years = new Set();

  function addQuery(kind, terms, { departments = [], courseCode = "", courseTitle = "", teacher = "", year = null } = {}) {
    const query = [board, ...terms].join(" ");
    if (!queries.has(query)) {
      queries.set(query, { kind, departments: new Set(), courseCodes: new Set(), courseTitle, teacher, year, query });
    }
    const row = queries.get(query);
    for (const department of departments) row.departments.add(department);
    if (courseCode) row.courseCodes.add(courseCode);
  }

  for (const { course, offerings = [] } of records) {
    if (course?.school !== "NCCU") continue;

    // The source is 開課系級 and includes class labels as well as departments.
    const departments = termsFromLabel(course.department, /[,、]+/u).filter((label) => label !== "開課單位待確認");
    for (const department of departments) {
      addQuery("department", [searchPhrase(department), "選課"], { departments: [department] });
    }

    const yearsForCourse = [...(course.offeredTerms ?? []), ...offerings.map(({ semester }) => semester)];
    for (const term of yearsForCourse) {
      const year = termYear(term);
      if (year !== null) years.add(year);
    }

    const courseTitle = cleanText(course.titleZh) || cleanText(course.titleEn);
    if (!courseTitle) continue;

    const courseCode = cleanText(course.code);
    addQuery("course", [searchPhrase(courseTitle)], { departments, courseCode, courseTitle });
    for (const offering of offerings) {
      const teachers = termsFromLabel(offering.teacher, teacherSeparators);
      for (const teacher of teachers) {
        if (teacherPlaceholder.test(teacher)) continue;
        addQuery("teacher_course", [searchPhrase(teacher), searchPhrase(courseTitle)], {
          departments, courseCode, courseTitle, teacher,
        });
      }
    }
  }

  for (const year of years) {
    for (const phrase of reviewPhrases) {
      addQuery("yearly_review", [searchPhrase(phrase), `after:${year - 1}-12-31`, `before:${year + 1}-01-01`], { year });
    }
  }

  return [...queries.values()]
    .sort((left, right) => (
      queryKinds.indexOf(left.kind) - queryKinds.indexOf(right.kind)
      || (right.year ?? 0) - (left.year ?? 0)
      || (left.query < right.query ? -1 : left.query > right.query ? 1 : 0)
    ))
    .map(({ kind, departments, courseCodes, courseTitle, teacher, year, query }) => ({
      kind,
      department: [...departments].sort().join(" | "),
      courseCode: [...courseCodes].sort().join(" | "),
      courseTitle,
      teacher,
      year,
      query,
      searchUrl: `https://www.google.com/search?${new URLSearchParams({ q: query })}`,
    }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

async function main() {
  const seedPath = process.argv[2] ?? fileURLToPath(new URL("../data/course-seed.json", import.meta.url));
  const outputPath = process.argv[3] ?? fileURLToPath(new URL("../data/dcard/all-nccu-search-queries.csv", import.meta.url));
  const { records } = JSON.parse(await readFile(seedPath, "utf8"));
  const queries = buildNccuSearchQueries(records);
  const counts = Object.fromEntries(queryKinds.map((kind) => [kind, 0]));
  const lines = ["kind,department,course_code,course_title,teacher,year,query,search_url"];
  for (const { kind, department, courseCode, courseTitle, teacher, year, query, searchUrl } of queries) {
    counts[kind] += 1;
    lines.push([kind, department, courseCode, courseTitle, teacher, year, query, searchUrl].map(csvCell).join(","));
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
  console.log(JSON.stringify({ queries: queries.length, counts, output: outputPath }));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
