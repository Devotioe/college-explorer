import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildNccuSearchQueries } from "../scripts/build-nccu-dcard-queries.mjs";

const records = [
  {
    course: { school: "NCCU", code: "0001", titleZh: "政治學", department: "政治系, 國發所", offeredTerms: ["113-1", "113-2"] },
    offerings: [{ semester: "113-1", teacher: "蔡中民、王韻，蔡中民; 詳備註 / 教師待確認, Ｎ／Ａ" }],
  },
  {
    course: { school: "NCCU", code: "0002", titleZh: " 政治學 ", department: "外交系" },
    offerings: [{ semester: "114-1", teacher: "蔡中民" }],
  },
  {
    course: { school: "NCCU", code: "0003", titleZh: "軟體工程", department: "資科碩一資碩工一" },
    offerings: [{ semester: "114-1", teacher: "無" }],
  },
  {
    course: { school: "NCCU", code: "0004", titleZh: " ", department: "資訊學院" },
    offerings: [{ semester: "114-1", teacher: "宋明德" }],
  },
  {
    course: { school: "NTHU", code: "0005", titleZh: "清大獨有課程", department: "清大系", offeredTerms: ["112-1"] },
    offerings: [{ semester: "112-1", teacher: "清大獨有教師" }],
  },
];

test("department queries preserve every catalog label, including class labels", () => {
  const departmentQueries = buildNccuSearchQueries(records).filter(({ kind }) => kind === "department");

  assert.deepEqual(new Set(departmentQueries.map(({ department }) => department)),
    new Set(["政治系", "國發所", "外交系", "資科碩一資碩工一", "資訊學院"]));
  assert.equal(departmentQueries.find(({ department }) => department === "政治系").query,
    'site:dcard.tw/f/nccu/p/ "政治系" 選課');
});

test("yearly review queries use the calendar years of NCCU fall and spring terms", () => {
  const yearly = buildNccuSearchQueries(records).filter(({ kind }) => kind === "yearly_review");

  assert.deepEqual(new Set(yearly.map(({ year }) => year)), new Set([2024, 2025]));
  assert.equal(yearly.length, 6);
  assert.ok(yearly.some(({ query }) => query === 'site:dcard.tw/f/nccu/p/ "修課心得" after:2023-12-31 before:2025-01-01'));
  assert.ok(yearly.some(({ query }) => query === 'site:dcard.tw/f/nccu/p/ "選課心得" after:2024-12-31 before:2026-01-01'));
  assert.ok(yearly.some(({ query }) => query.includes('"課程心得"')));
});

test("exact course-title queries deduplicate identical searches and retain all catalog metadata", () => {
  const courses = buildNccuSearchQueries(records).filter(({ kind }) => kind === "course");

  assert.equal(courses.length, 2);
  const politics = courses.find(({ courseTitle }) => courseTitle === "政治學");
  assert.equal(politics.query, 'site:dcard.tw/f/nccu/p/ "政治學"');
  assert.deepEqual(new Set(politics.courseCode.split(" | ")), new Set(["0001", "0002"]));
  assert.deepEqual(new Set(politics.department.split(" | ")), new Set(["政治系", "國發所", "外交系"]));
  assert.equal(new URL(politics.searchUrl).searchParams.get("q"), politics.query);
});

test("teacher-and-course queries use individual historical names and skip placeholders or missing titles", () => {
  const teachers = buildNccuSearchQueries(records).filter(({ kind }) => kind === "teacher_course");

  assert.deepEqual(new Set(teachers.map(({ query }) => query)), new Set([
    'site:dcard.tw/f/nccu/p/ "蔡中民" "政治學"',
    'site:dcard.tw/f/nccu/p/ "王韻" "政治學"',
  ]));
  assert.equal(teachers.length, 2);
  assert.equal(teachers.find(({ teacher }) => teacher === "王韻").courseCode, "0001");
});

test("the inventory is deterministic and contains no duplicate or non-NCCU search", () => {
  const rows = buildNccuSearchQueries(records);

  assert.deepEqual(buildNccuSearchQueries([...records].reverse()), rows);
  assert.equal(new Set(rows.map(({ query }) => query)).size, rows.length);
  assert.ok(rows.every(({ query }) => !query.includes("清大")));
  assert.deepEqual(buildNccuSearchQueries(records.slice(-1)), []);
});

test("the generator writes a CSV with escaped search queries from a seed file", async (t) => {
  const workingDirectory = await mkdtemp(join(tmpdir(), "nccu-dcard-queries-"));
  t.after(() => rm(workingDirectory, { recursive: true, force: true }));
  const seedPath = join(workingDirectory, "course-seed.json");
  const outputPath = join(workingDirectory, "dcard", "queries.csv");
  const scriptPath = fileURLToPath(new URL("../scripts/build-nccu-dcard-queries.mjs", import.meta.url));
  await writeFile(seedPath, JSON.stringify({ records }));

  await promisify(execFile)(process.execPath, [scriptPath, seedPath, outputPath]);

  const csv = await readFile(outputPath, "utf8");
  assert.match(csv, /^\uFEFFkind,department,course_code,course_title,teacher,year,query,search_url\r?\n/);
  assert.ok(csv.includes('"site:dcard.tw/f/nccu/p/ ""政治學"""'));
  assert.ok(!csv.includes("清大"));
});
