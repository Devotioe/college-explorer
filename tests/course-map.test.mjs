import assert from "node:assert/strict";
import test from "node:test";
import { buildCourseMapBranches, buildSemesterPlan, getCourseRequirementNotes } from "../lib/course-map.ts";

const course = (code, title, properties = {}) => ({
  id: `nccu-${code}`, school: "NCCU", code, title, level: "大學部", domains: [], ...properties,
});
const transcript = (courseCode, courseName, gradeRaw, term = "114-1") => ({ courseCode, courseName, gradeRaw, term });
const sharedDomains = (left, right) => left.domains.filter((domain) => right.domains.includes(domain));

test("parses NCCU's insurance contract law requirements as AND groups with alternatives", () => {
  const target = course("308041001", "保險契約法", {
    prerequisites: "[ 保險學(單學期)(修習且及格)] 及 [ 民法(單學期)(修習且及格) 或 民法概要(單學期)(修習且及格)] 及 [ 人壽保險(單學期)(修習且及格)]",
  });
  const insurance = course("308001001", "保險學");
  const riskCivil = course("308003011", "民法概要");
  const lawCivil = course("000603001", "民法概要");
  const life = course("308016001", "人壽保險");
  const unrelated = course("308020001", "保險學概論");
  const catalog = [lawCivil, riskCivil, life, unrelated, target, insurance];
  const completed = [transcript(insurance.code, insurance.title, "84"), transcript(lawCivil.code, lawCivil.title, "抵免"), transcript(life.code, life.title, "W")];
  const result = buildCourseMapBranches(target, catalog, completed, sharedDomains);
  assert.deepEqual(result.map(({ requirement, conditions, courses, relation, status }) => [requirement, conditions, courses.map((x) => x.code), relation, status]), [
    ["保險學", "單學期・修習且及格", [insurance.code], "official", "passed"],
    ["民法 或 民法概要", "任一門・單學期・修習且及格", [riskCivil.code], "official", "recorded"],
    ["人壽保險", "單學期・修習且及格", [life.code], "official", "no-record"],
  ]);
  assert.equal(new Set(result.map((branch) => branch.key)).size, 3);
});

test("keeps labeled prerequisites when a catalog match is absent or ambiguous", () => {
  const target = course("104400001", "指定專題", { prerequisites: "[ 民法概要(單學期)(有修即可)] 及 [ 程式原理(單學期)(修習且及格)]" });
  const lawCivil = course("000603001", "民法概要");
  const riskCivil = course("308003011", "民法概要");
  const nthuProgramming = course("CS1001", "程式原理", { id: "nthu-cs1001", school: "NTHU" });
  const similarTitle = course("703111001", "程式原理導論");
  const result = buildCourseMapBranches(target, [lawCivil, riskCivil, nthuProgramming, similarTitle], [transcript("", "民法概要", "P")], sharedDomains);
  assert.deepEqual(result.map(({ requirement, courses, status }) => [requirement, courses.length, status]), [
    ["民法概要", 0, "recorded"],
    ["程式原理", 0, "no-record"],
  ]);
});

test("uses a unique departmental prefix for a label without asserting a passing match", () => {
  const target = course("308041001", "保險契約法", { prerequisites: "[民法概要(單學期)(修習且及格)]" });
  const preferred = course("308003011", "民法概要");
  const unrelatedDepartment = course("000603001", "民法概要");
  const [branch] = buildCourseMapBranches(target, [unrelatedDepartment, preferred], [], sharedDomains);
  assert.deepEqual(branch.courses, [preferred]);
  assert.equal(branch.status, "no-record");
  assert.equal(buildCourseMapBranches(target, [unrelatedDepartment, preferred], [transcript(preferred.code, preferred.title, "P")], sharedDomains)[0].status, "passed");
});

test("a passing transcript cannot resolve an ambiguous formal course across departments", () => {
  const target = course("203007001", "國際公法", { prerequisites: "[國際關係(單學期)(修習且及格)]" });
  const offerings = ["000227001", "010117001", "ZU1872001"].map((code) => course(code, "國際關係"));
  const [branch] = buildCourseMapBranches(target, offerings, [transcript("ZU1872001", "國際關係", "91")], sharedDomains);
  assert.deepEqual(branch.courses, []);
  assert.equal(branch.status, "recorded");
});

test("preserves different durations and completion conditions inside one alternative group", () => {
  const target = course("207430001", "土地登記", { prerequisites: "[ 民法（一）(單學期)(有修即可)] 及 [ 民法概要(單學期)(修習且及格) 或 土地法(全學年)(有修即可)]" });
  const branches = buildCourseMapBranches(target, [], [], sharedDomains);
  assert.equal(branches[0].conditions, "單學期・有修即可");
  assert.equal(branches[1].conditions, "任一門：民法概要（單學期・修習且及格）或土地法（全學年・有修即可）");
});

test("keeps whole-year, unverified numeric grades and failed attempts as recorded", () => {
  const target = course("208024001", "進階經濟", { prerequisites: "[ 經濟學(全學年)(修習且及格)] 及 [ 統計學(單學期)(修習且及格)] 及 [ 理論專題(單學期)(修習且及格)]" });
  const economics = course("000219011", "經濟學");
  const unknownLevel = course("208010001", "統計學", { level: undefined });
  const theory = course("208022001", "理論專題");
  const catalog = [economics, unknownLevel, theory];
  const completed = [transcript(economics.code, "經濟學", "P"), transcript(unknownLevel.code, "統計學", "82"), transcript(theory.code, "理論專題", "57")];
  assert.deepEqual(buildCourseMapBranches(target, catalog, completed, sharedDomains).map((branch) => branch.status), ["recorded", "recorded", "recorded"]);
});

test("preserves named course parts and rejects conflicting transcript codes and close titles", () => {
  const target = course("303401001", "商業分析", { prerequisites: "［初級會計學（一）(單學期)(修習且及格)］" });
  const first = course("000314011", "初級會計學(一)");
  const second = course("000315011", "初級會計學（二）");
  const wrong = [transcript(second.code, "初級會計學（一）", "95"), transcript(first.code, "初級會計学簡介", "90")];
  assert.deepEqual(buildCourseMapBranches(target, [first, second], wrong, sharedDomains).map(({ courses, status }) => [courses, status]), [[[first], "no-record"]]);
  assert.equal(buildCourseMapBranches(target, [first, second], [transcript("", "初級會計學（一）", "60")], sharedDomains)[0].status, "passed");
});

test("recognizes a unique exact transcript title when the catalog has no matching section code", () => {
  const target = course("308041001", "保險契約法", { prerequisites: "[保險學(單學期)(修習且及格)]" });
  const insurance = course("308001001", "保險學");
  const attempts = [transcript("308001011", "保險學", "61", "113-1"), transcript(insurance.code, "保險學", "W", "114-1")];
  assert.equal(buildCourseMapBranches(target, [insurance], attempts, sharedDomains)[0].status, "passed");
});

test("skips withdrawal and provisional grades in both official and related maps", () => {
  const target = course("308041001", "保險契約法", { prerequisites: "[保險學(單學期)(修習且及格)]", domains: ["保險"] });
  const insurance = course("308001001", "保險學", { domains: ["保險"] });
  const attempts = [transcript(insurance.code, insurance.title, "Ｗ（退選）"), transcript(insurance.code, insurance.title, "修課中")];
  assert.equal(buildCourseMapBranches(target, [insurance], attempts, sharedDomains)[0].status, "no-record");
  assert.equal(buildCourseMapBranches({ ...target, prerequisites: undefined }, [insurance], attempts, sharedDomains)[0].status, "no-record");
});

test("matches a six-digit subject only when the course resolves without a conflicting title", () => {
  const target = course("308041001", "保險契約法", { prerequisites: "[保險學(單學期)(修習且及格)]" });
  const insurance = course("308001001", "保險學");
  const catalog = [insurance];
  assert.equal(buildCourseMapBranches(target, catalog, [transcript("308001", "", "P")], sharedDomains)[0].status, "passed");
  assert.equal(buildCourseMapBranches(target, catalog, [transcript("308001", "保險專題", "P")], sharedDomains)[0].status, "no-record");
});

test("uses only domain-related courses for discovery and prioritizes a matching NCCU transcript", () => {
  const target = course("308100001", "財務專題", { domains: ["經濟", "資料"], prerequisites: "無先修設定" });
  const passed = course("000219001", "經濟學", { domains: ["經濟"] });
  const unrelated = course("201001001", "西洋文學", { domains: ["文學"] });
  const nccu = ["108000001", "108001001", "108002001", "108003001"].map((code) => course(code, `財務應用${code}`, { domains: ["經濟", "資料"] }));
  const nthu = course("CS1001", "資料結構", { id: "nthu-cs1001", school: "NTHU", domains: ["經濟", "資料"] });
  const catalog = [unrelated, ...nccu, nthu, target, passed, passed];
  const records = [transcript(passed.code, passed.title, "86"), transcript(unrelated.code, unrelated.title, "91"), transcript(nthu.code, nthu.title, "85")];
  const result = buildCourseMapBranches(target, catalog, records, sharedDomains);
  assert.equal(result.length, 4);
  assert.equal(result[0].courses[0], passed);
  assert.equal(result[0].status, "passed");
  assert.ok(result.every(({ relation, courses }) => relation === "related" && courses[0] !== target && courses[0] !== unrelated));
  assert.ok(result.some(({ courses, status }) => courses[0] === nthu && status === "no-record"));
  assert.deepEqual(result, buildCourseMapBranches(target, [...catalog].reverse(), records, sharedDomains));
});

test("excludes same-title peers and graduate courses for undergraduate discovery", () => {
  const target = course("308100001", "財務專題（一）", { domains: ["資料"] });
  const peer = course("CS1001", "財務專題(一)", { id: "nthu-cs1001", school: "NTHU", domains: ["資料"] });
  const graduate = course("358111001", "財務研究", { level: "研究所", domains: ["資料"] });
  const related = course("306011001", "財務資料分析", { domains: ["資料"] });
  assert.deepEqual(buildCourseMapBranches(target, [peer, graduate, related], [], sharedDomains).map((branch) => branch.courses[0]), [related]);
});

test("does not force a cross-school result with only one shared domain", () => {
  const target = course("308100001", "財務專題", { domains: ["資料"] });
  const local = ["108000001", "108001001", "108002001", "108003001"].map((code) => course(code, `財務應用${code}`, { domains: ["資料"] }));
  const crossSchool = course("CS1001", "資料結構", { id: "nthu-cs1001", school: "NTHU", domains: ["資料"] });
  assert.deepEqual(buildCourseMapBranches(target, [...local, crossSchool], [], sharedDomains).map((branch) => branch.courses[0]), local);
});

test("never invents a branch from unparsed text or a nonmatching domain", () => {
  const target = course("308041001", "保險契約法", { prerequisites: "[ 保險學(單學期)(修習且及格) 或 民法(單學期)(修" });
  const insurance = course("308001001", "保險學");
  assert.deepEqual(buildCourseMapBranches(target, [target, insurance], [], sharedDomains), []);
});

test("parses NTHU's joined course labels and keeps exclusions outside the prerequisites", () => {
  const nthu = (code, title, prerequisites) => course(code, title, { school: "NTHU", prerequisites });
  const target = nthu("EE3230", "積體電路設計導論",
    "擋修對象 : 大學部\n先修科目 : 電子學一-成績需C-以上電子學-成績需C-以上上述條件任選一科，而且 曾修邏輯設計曾修電路學上述條件一定要有，而且 未修過舊版實驗上述條件一定要有，則不擋修。｜限電機系");
  const catalog = [target, nthu("EE2250", "電子學一"), nthu("EE1001", "邏輯設計"), nthu("EE1002", "電路學"), nthu("EE1003", "舊版實驗")];
  const branches = buildCourseMapBranches(target, catalog, [], sharedDomains);
  assert.deepEqual(branches.map(({ requirement }) => requirement), ["電子學一 或 電子學", "邏輯設計", "電路學"]);
  assert.match(branches[0].conditions, /成績需 C- 以上/);
  assert.deepEqual(getCourseRequirementNotes(target), ["擋修適用對象・大學部", "未修過條件（一定要有）・舊版實驗"]);
});

test("a semester plan follows multiple prerequisite levels and skips a completed prerequisite", () => {
  const first = course("703001001", "基礎");
  const second = course("703002001", "中階", { prerequisites: "[基礎(單學期)(修習且及格)]" });
  const goal = course("703003001", "專題", { prerequisites: "[中階(單學期)(修習且及格)]" });
  const catalog = [first, second, goal];
  const titles = (plan) => plan.semesters.map(([semester, entries]) => [semester, entries.map(({ course }) => course.title)]);
  assert.deepEqual(titles(buildSemesterPlan([goal], catalog, [])), [[1, ["基礎"]], [2, ["中階"]], [3, ["專題"]]]);
  assert.deepEqual(titles(buildSemesterPlan([goal], catalog, [transcript(first.code, first.title, "84")])), [[1, ["中階"]], [2, ["專題"]]]);
});

test("a selectable alternative resolves a cycle, but an unresolved all-year condition still blocks its course", () => {
  const root = course("703001001", "基礎");
  const first = course("703002001", "第一專題", { prerequisites: "[第二專題(單學期)(修習且及格) 或 基礎(單學期)(修習且及格)]" });
  const second = course("703003001", "第二專題", { prerequisites: "[第一專題(單學期)(修習且及格)]" });
  const final = course("703004001", "校外實習", { prerequisites: "[第二專題(單學期)(修習且及格)] 及 [專題研究(全學年)(修習且及格)]" });
  const plan = buildSemesterPlan([final], [root, first, second, final], []);
  assert.deepEqual(plan.semesters.map(([number, items]) => [number, items.map(({ course }) => course.id)]), [
    [1, [root.id]], [2, [first.id]], [3, [second.id]],
  ]);
  assert.match(plan.notes[0], /專題研究（全學年）/);
});
