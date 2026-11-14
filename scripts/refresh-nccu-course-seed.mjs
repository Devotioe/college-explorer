import fs from "node:fs/promises";

const seedPath = process.argv[2] ?? "data/course-seed.json";
const indexPath = process.argv[3] ?? "data/nccu-course-details.json";
const seed = JSON.parse(await fs.readFile(seedPath, "utf8"));
const nccuCourses = JSON.parse(await fs.readFile(indexPath, "utf8"));

const topicRules = [
  ["程式與軟體", /程式|軟體|演算法|資料結構|program|software|algorithm|coding/i],
  ["資料與 AI", /資料|人工智慧|機器學習|統計|量化|data|artificial intelligence|machine learning|statistics|analytics/i],
  ["環境與永續", /環境|永續|氣候|碳|environment|sustainab|climate|carbon/i],
  ["政策、法律與治理", /政策|法律|治理|倫理|社會|policy|law|governance|ethic|society/i],
  ["經濟與決策", /經濟|金融|財務|決策|econom|finance|decision|investment/i],
  ["化學與生醫", /化學|生醫|生物|醫學|chemistry|biomedical|biology|medical/i],
  ["設計與創新", /設計|創新|互動|design|innovation|interaction|creative/i],
];

const idFor = (code) => `nccu-${String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const records = seed.records.filter((record) => record.course.school !== "NCCU");

for (const item of nccuCourses) {
  const id = idFor(item.code);
  const searchable = `${item.title} ${item.titleEn} ${item.description}`;
  const topics = topicRules.filter(([, pattern]) => pattern.test(searchable)).map(([topic]) => topic);
  if (!topics.length) topics.push("其他領域");
  const latestTerm = item.offeredTerms?.[0] ?? "歷年課程";
  const graduate = /碩|博|研究所/.test(item.department ?? "");
  records.push({
    course: {
      id,
      school: "NCCU",
      code: item.code,
      titleZh: item.title,
      titleEn: item.titleEn || item.title,
      department: item.department || "開課單位待確認",
      credits: Number(item.credits) || 0,
      level: graduate ? "研究所" : "大學部",
      topics,
      description: (item.description || "").slice(0, 600),
      objectives: "",
      prerequisites: (item.prerequisites || "").slice(0, 300),
      syllabusUrl: item.syllabusUrl || "",
      syllabusSource: item.syllabusSource || "",
      offeredTerms: item.offeredTerms || [],
      requirement: item.requirement || "",
    },
    offerings: [{
      id: `${id}-${latestTerm}`,
      courseId: id,
      semester: latestTerm,
      section: "00",
      teacher: item.teachers || "教師待確認",
      language: item.language || "語言待確認",
      schedule: "時間請見政大課程大綱",
      capacity: null,
      source: "nccu_course_history.csv",
    }],
  });
}

records.sort((a, b) => a.course.school.localeCompare(b.course.school) || a.course.code.localeCompare(b.course.code));
await fs.writeFile(seedPath, JSON.stringify({ ...seed, generatedAt: new Date().toISOString(), nccuSourceRecords: nccuCourses.length, records }));
console.log(JSON.stringify({ courses: records.length, nccuCourses: nccuCourses.length, output: seedPath }));
