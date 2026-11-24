import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const curl = process.platform === "win32" ? "curl.exe" : "curl";
const exec = promisify(execFile);
const unitUrl = "https://qrysub.nccu.edu.tw/assets/api/unit.json";
const api = "https://es.nccu.edu.tw/course/zh-TW/";
const cacheDir = new URL("../.wrangler/nccu-offerings-source/", import.meta.url);
const outputUrl = new URL("../data/nccu-offerings.json", import.meta.url);
const seed = JSON.parse(await readFile(new URL("../data/course-seed.json", import.meta.url), "utf8"));
const catalog = seed.records.filter(({ course }) => course.school === "NCCU").map(({ course }) => course);
const semesters = [...new Set(catalog.flatMap((course) => course.offeredTerms.filter((term) => /^\d{3}-[12]$/.test(term))))].sort();
const maxRows = 500;
const batchSize = 5;

async function readJson(url) {
  const { stdout } = await exec(curl, ["-fsS", "--retry", "2", "--max-time", "25", url], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  const data = JSON.parse(stdout);
  if (!Array.isArray(data)) throw new Error(`Expected an array from ${url}`);
  return data;
}

function children(nodes, depth) {
  return nodes.filter((node) => node[`utCodL${depth}`] !== "0");
}

async function fetchPartition(semester, path) {
  if (!path.every((code) => /^[a-z\d]+$/i.test(code))) throw new Error("Invalid unit code");
  const query = [`:sem=${semester.replace("-", "")}`, ...path.map((code, index) => `:dp${index + 1}=${code}`)].join("%20");
  const rows = await readJson(`${api}${query}%20/`);
  if (rows.length > maxRows) throw new Error(`Unexpected row count for ${semester} ${path.join("/")}`);
  return rows;
}

async function fetchUnit(semester, node, path = [node.utCodL1]) {
  const rows = await fetchPartition(semester, path);
  if (rows.length < maxRows) return rows;
  const nextDepth = path.length + 1;
  const partitions = children(node[`utL${nextDepth}`] ?? [], nextDepth);
  if (!partitions.length) throw new Error(`Truncated response for ${semester} ${path.join("/")}`);
  const expanded = new Map(rows.map((row) => [row.subNum, row]));
  for (const child of partitions) {
    for (const row of await fetchUnit(semester, child, [...path, child[`utCodL${nextDepth}`]])) {
      expanded.set(row.subNum, row);
    }
  }
  if (expanded.size <= maxRows) throw new Error(`Could not verify complete partition ${semester} ${path.join("/")}`);
  return [...expanded.values()];
}

async function fetchSemester(semester, units) {
  const file = new URL(`${semester}.json`, cacheDir);
  if (process.argv.includes("--reuse-cache")) {
    try { return JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const rows = [];
  for (let offset = 0; offset < units.length; offset += batchSize) {
    const batch = await Promise.all(units.slice(offset, offset + batchSize).map((unit) => fetchUnit(semester, unit)));
    rows.push(...batch.flat());
  }
  const projected = projectRows(rows);
  if (!projected.length || projected.some((row) => row.semester !== semester)) throw new Error(`Incomplete or incorrect result for ${semester}`);
  await writeFile(file, JSON.stringify(projected));
  return projected;
}

function projectRows(rows) {
  return rows.map(({ y, s, subNum, subNam, teaNam, subTime, teaSchmUrl, langTpe }) => ({
    semester: `${y}-${s}`, code: subNum, title: subNam, teacher: teaNam, slots: subTime, sourceUrl: teaSchmUrl, language: langTpe,
  }));
}

async function fetchProgramOfferings(semester) {
  // Some 070 offerings are absent from the school-unit tree but returned by its public keyword search.
  const rows = await readJson(`${api}:sem=${semester.replace("-", "")}%20070%20/`);
  if (rows.length >= maxRows) throw new Error(`Truncated 070 keyword results for ${semester}`);
  const projected = projectRows(rows.filter(({ subNum }) => subNum?.startsWith("070")));
  if (projected.some((row) => row.semester !== semester)) throw new Error(`Incorrect 070 semester result for ${semester}`);
  return projected;
}

function titleKey(title) {
  return title.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "").replace(/台/g, "臺").toLowerCase();
}

await mkdir(cacheDir, { recursive: true });
const units = children(await readJson(unitUrl), 1);
const bySubject = new Map(catalog.map((course) => [course.code.slice(0, 6), course]));
if (bySubject.size !== catalog.length) throw new Error("Multiple catalog courses share a subject code");
const grouped = new Map();
const coverage = {};
for (const semester of semesters) {
  const lookup = new Map();
  let invalid = 0;
  const [unitRows, programRows] = await Promise.all([fetchSemester(semester, units), fetchProgramOfferings(semester)]);
  for (const row of [...unitRows, ...programRows]) {
    if (!/^[a-z\d]{6}\d{3}$/i.test(row.code ?? "") || !row.title?.trim()) { invalid++; continue; }
    const previous = lookup.get(row.code);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) {
      const signature = (item) => [titleKey(item.title), item.teacher?.trim(), item.slots?.trim()].join("|");
      if (signature(previous) !== signature(row)) {
        throw new Error(`Conflicting official records for ${semester} ${row.code}`);
      }
    }
    lookup.set(row.code, row);
  }
  let matched = 0;
  const titleConflicts = [];
  for (const row of lookup.values()) {
    const course = bySubject.get(row.code.slice(0, 6));
    if (!course) continue;
    const differentTitle = titleKey(course.titleZh) !== titleKey(row.title);
    // The 115-1 live listing uses the shorter title for this exact catalog code.
    const verifiedTitleChange = semester === "115-1" && course.code === "357912001" && row.code === course.code
      && course.titleZh === "財務論文研讀（一）" && row.title === "財務論文研讀";
    if (differentTitle && !verifiedTitleChange) {
      titleConflicts.push([row.code, row.title, course.titleZh]);
      continue;
    }
    const sourceUrl = /^https?:\/\/[^/]+\.nccu\.edu\.tw\//i.test(row.sourceUrl ?? "") ? row.sourceUrl.replace(/^http:/, "https:") : "https://qrysub.nccu.edu.tw/";
    const offerings = grouped.get(course.id) ?? [];
    offerings.push([semester, row.code, row.teacher?.trim() || "", row.slots?.trim() || "", row.language?.trim() || "", sourceUrl,
      ...(verifiedTitleChange ? [row.title] : [])]);
    grouped.set(course.id, offerings);
    matched++;
  }
  const missingSubjects = catalog.filter((course) => course.offeredTerms.includes(semester) &&
    !grouped.get(course.id)?.some(([term]) => term === semester)).map(({ code, titleZh }) => [code, titleZh]);
  coverage[semester] = { official: lookup.size, matched, invalid, titleConflicts, missingSubjects };
  console.log(`${semester}: ${matched} 班已配對 / ${lookup.size} 班官方資料，${missingSubjects.length} 門目錄課未找到，${titleConflicts.length} 班課名不同。`);
}
const courses = Object.fromEntries([...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([id, rows]) => [
  id, rows.sort(([a, codeA], [b, codeB]) => b.localeCompare(a) || codeA.localeCompare(codeB)),
]));
if (!courses["nccu-306049001"]?.some(([semester, code]) => semester === "115-1" && code === "306049011")) {
  throw new Error("Missing expected current programming section");
}
const pending = new URL("../data/nccu-offerings.json.tmp", import.meta.url);
await writeFile(pending, JSON.stringify({ sourceUrl: "https://qrysub.nccu.edu.tw/", coverage, courses }));
await rename(pending, outputUrl);
console.log(`Wrote ${Object.keys(courses).length} catalog courses to ${outputUrl.pathname.split("/").at(-1)}.`);
