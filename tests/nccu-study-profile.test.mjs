import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import courseSeed from "../data/course-seed.json" with { type: "json" };
import { buildNccuStudyProfile, departmentMascots, mascotIconPath } from "../lib/nccu-study-profile.ts";

const catalog = [
  { id: "nccu-accounting", school: "NCCU", code: "000314011", title: "初級會計學（一）", unit: "會計系" },
  { id: "nccu-management", school: "NCCU", code: "000348001", title: "管理學", unit: "企管系" },
  { id: "nccu-personnel", school: "NCCU", code: "305009001", title: "人力資源管理", unit: "企管二甲企管二乙" },
  { id: "nccu-political-science", school: "NCCU", code: "000211011", title: "政治學", unit: "政治系" },
  { id: "nccu-economics", school: "NCCU", code: "000219011", title: "經濟學", unit: "經濟系, 國貿系" },
  { id: "nccu-english", school: "NCCU", code: "032001011", title: "大學英文（一）", unit: "外文中" },
  { id: "nccu-japanese", school: "NCCU", code: "506008001", title: "日語會話（一）", unit: "日文二日文三" },
  { id: "nccu-physics", school: "NCCU", code: "043065001", title: "量子世界", unit: "應物所" },
  { id: "nccu-chemistry", school: "NCCU", code: "782003001", title: "基礎物理", unit: "電物學程" },
  { id: "nccu-general", school: "NCCU", code: "090088001", title: "預防醫學與校園健康", unit: "教務處通識教育中心" },
  { id: "nccu-programming", school: "NCCU", code: "046001001", title: "程式設計概論", unit: "資訊學院" },
  { id: "nccu-another-management", school: "NCCU", code: "070091001", title: "管理學", unit: "商學院" },
  { id: "nthu-management", school: "NTHU", code: "IBPM 3001", title: "管理學", unit: "企業管理學系" },
];

const transcript = (courseCode, courseName, gradeRaw = "A-", term = "114-1") => ({
  courseCode, courseName, gradeRaw, term, credits: 3,
});

test("classifies a mixed-prefix NCCU code by its actual unit", () => {
  const profile = buildNccuStudyProfile([
    transcript("０００３１４", "初級會計學(一)"),
    transcript("000348010", "管理學"),
    transcript("305009001", "人力資源管理"),
    transcript("000211011", "政治學"),
  ], catalog);

  assert.deepEqual(profile.colleges, [{ name: "商學院", count: 3 }, { name: "社會科學學院", count: 1 }]);
  assert.deepEqual(profile.departments, [
    { name: "企業管理學系", count: 2 },
    ...[{ name: "會計學系", count: 1 }, { name: "政治學系", count: 1 }].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
  ]);
  assert.deepEqual(profile.titles, ["商院狗", "企管狗"]);
  assert.equal(profile.countedCount, 4);
});

test("counts repeated courses once and includes taken failing grades", () => {
  const profile = buildNccuStudyProfile([
    transcript("000314011", "初級會計學（一）", "F", "113-1"),
    transcript("000314", "初級會計學（一）", "A", "114-1"),
    transcript("000314021", "初級會計學（一）", "A", "114-1"),
    transcript("000348001", "管理學", "0"),
    transcript("000211011", "政治學", "Ｗ（退選）"),
    transcript("032001011", "大學英文（一）", ""),
    transcript("043065001", "量子世界", "修課中"),
  ], catalog);

  assert.equal(profile.countedCount, 2);
  assert.equal(profile.unclassifiedCount, 0);
  assert.deepEqual(profile.colleges, [{ name: "商學院", count: 2 }]);
  assert.deepEqual(profile.titles, ["商院狗"]);
});

test("keeps unmatched, ambiguous, unrelated and cross-college rows unclassified", () => {
  const profile = buildNccuStudyProfile([
    transcript("", "管理學"),
    transcript("", "航太動力"),
    transcript("", "航太動力", "70", "113-1"),
    transcript("000348001", "政治學"),
    transcript("000314011", "全然不相關的課名"),
    transcript("000219011", "經濟學"),
    transcript("090088001", "預防醫學與校園健康"),
    transcript("IBPM 3001", "管理學"),
    transcript("", "程式設計概論"),
  ], catalog);

  assert.equal(profile.countedCount, 8);
  assert.equal(profile.unclassifiedCount, 7);
  assert.deepEqual(profile.colleges, [{ name: "資訊學院", count: 1 }]);
  assert.deepEqual(profile.departments, []);
  assert.deepEqual(profile.titles, []);
});

test("awards only the supplied title for a uniquely leading college or teaching unit", () => {
  const tied = buildNccuStudyProfile([
    transcript("000314011", "初級會計學（一）"),
    transcript("506008", "日語會話（一）"),
  ], catalog);
  assert.deepEqual(tied.titles, []);

  const language = buildNccuStudyProfile([
    transcript("032001011", "大學英文（一）"),
    transcript("506008", "日語會話（一）"),
    transcript("000314011", "初級會計學（一）"),
  ], catalog);
  assert.deepEqual(language.titles, ["語文貓"]);
  assert.deepEqual(language.colleges[0], { name: "外國語文學院", count: 2 });

  const physics = buildNccuStudyProfile([transcript("043065001", "量子世界")], catalog);
  assert.deepEqual(physics.titles, ["物理蘋果"]);
  assert.deepEqual(physics.departments, [{ name: "應用物理研究所", count: 1 }]);
});

test("switches the mascot when the unique leading department changes and omits it for ties", () => {
  const codes = ["306005001", "306009001", "302018001", "302032011", "302034001"];
  const courses = codes.map((code) => {
    const { course } = courseSeed.records.find(({ course }) => course.school === "NCCU" && course.code === code);
    return { id: course.id, school: course.school, code, title: course.titleZh, unit: course.department };
  });
  const [firstMis, secondMis, firstFinance, secondFinance, thirdFinance] = courses.map(({ code, title }) => transcript(code, title));
  const leadingMis = [firstMis, secondMis, firstFinance];
  assert.deepEqual(buildNccuStudyProfile(leadingMis, courses).departmentMascot, {
    name: "資訊管理學系", count: 2, label: "資管浣熊", symbol: "🦝",
  });

  const tied = [...leadingMis, secondFinance, { ...firstMis, term: "115-1" }];
  assert.equal(buildNccuStudyProfile(tied, courses).departmentMascot, null);
  assert.deepEqual(buildNccuStudyProfile([...tied, thirdFinance], courses).departmentMascot, {
    name: "金融學系", count: 3, label: "金融金幣", symbol: "🪙",
  });
});

test("each department has a unique mascot name and a bundled PNG icon", () => {
  const labels = new Set();
  const symbols = new Set();
  for (const [department, { label, symbol }] of Object.entries(departmentMascots)) {
    const path = mascotIconPath(symbol);
    assert.ok(label && symbol, department);
    assert.ok(!labels.has(label), `${department} repeats the label ${label}`);
    assert.ok(!symbols.has(path), `${department} repeats the icon ${path}`);
    const artwork = readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.equal(artwork.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", department);
    assert.equal(artwork.readUInt32BE(16), 72, department);
    assert.equal(artwork.readUInt32BE(20), 72, department);
    const resultArt = readFileSync(new URL(`../public${mascotIconPath(symbol, "mascot-results")}`, import.meta.url));
    assert.equal(resultArt.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", department);
    assert.equal(resultArt.readUInt32BE(16), 512, department);
    assert.equal(resultArt.readUInt32BE(20), 512, department);
    labels.add(label);
    symbols.add(path);
  }
});

test("uses an exact normalized title if the code supplies no catalog evidence", () => {
  const profile = buildNccuStudyProfile([transcript("", "　初級會計學(一) ")], catalog);
  assert.deepEqual(profile.departments, [{ name: "會計學系", count: 1 }]);
});

test("counts a known college once when listed with more than one of its units", () => {
  const jointUnit = { id: "nccu-bu", school: "NCCU", code: "042805001", title: "企業與財會", unit: "企管系、會計系" };
  const profile = buildNccuStudyProfile([transcript(jointUnit.code, jointUnit.title)], [...catalog, jointUnit]);
  assert.deepEqual(profile.colleges, [{ name: "商學院", count: 1 }]);
  assert.deepEqual(profile.departments, []);
  assert.equal(profile.countedCount, 1);
  assert.equal(profile.unclassifiedCount, 0);
});

test("classifies actual college-level catalog labels without assigning a department", () => {
  const examples = [
    ["300008001", "商院學士", "商學院"],
    ["100713001", "文院學士", "文學院"],
    ["400853001", "傳播院學", "傳播學院"],
    ["900031001", "教院碩士教院學士", "教育學院"],
    ["300744001", "商院學士, 商院碩士", "商學院"],
  ];

  for (const [code, unit, college] of examples) {
    const source = courseSeed.records.find((row) => row.course.school === "NCCU" && row.course.code === code)?.course;
    assert.equal(source?.department, unit, code);
    const course = { id: source.id, school: source.school, code, title: source.titleZh, unit };
    const profile = buildNccuStudyProfile([transcript(code, source.titleZh)], [course]);
    assert.deepEqual(profile.colleges, [{ name: college, count: 1 }], code);
    assert.deepEqual(profile.departments, [], code);
    assert.equal(profile.unclassifiedCount, 0, code);
  }
});

test("does not accept arbitrary labels beginning with an abbreviated college name", () => {
  const unknown = { id: "not-an-opening-unit", school: "NCCU", code: "070777001", title: "校務活動", unit: "商院學術合作中心" };
  const profile = buildNccuStudyProfile([transcript(unknown.code, unknown.title)], [unknown]);

  assert.deepEqual(profile.colleges, []);
  assert.equal(profile.unclassifiedCount, 1);
});

test("classifies verified program abbreviations from actual NCCU courses", () => {
  const examples = [
    ["046006001", "人智應學士", "資訊學院", "人工智慧應用學士學位學程"],
    ["463002001", "傳播博一傳播博二", "傳播學院", "傳播學院博士班"],
    ["464773001", "傳播碩一傳播碩二", "傳播學院", "傳播學院傳播碩士學位學程"],
    ["961006001", "法碩專一法碩專二", "法學院", "法學院碩士在職專班"],
  ];

  for (const [code, unit, college, department] of examples) {
    const source = courseSeed.records.find((row) => row.course.school === "NCCU" && row.course.code === code)?.course;
    assert.equal(source?.department, unit, code);
    const course = { id: source.id, school: source.school, code, title: source.titleZh, unit };
    const profile = buildNccuStudyProfile([transcript(code, course.title)], [course]);
    assert.deepEqual(profile.colleges, [{ name: college, count: 1 }], code);
    assert.deepEqual(profile.departments, [{ name: department, count: 1 }], code);
    assert.equal(profile.unclassifiedCount, 0, code);
  }
});
