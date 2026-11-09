import fs from "node:fs/promises";
import path from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/build-course-seed.mjs <input.json> <output.json>");
}

const source = JSON.parse(await fs.readFile(inputPath, "utf8"));
const courseMap = new Map();

const topicRules = [
  ["程式與軟體", /program|software|algorithm|data structure|app design|computational/i],
  ["資料與 AI", /data|artificial intelligence|machine learning|statistics|analytics|prediction/i],
  ["環境與永續", /environment|sustainab|green energy|ecological|climate/i],
  ["政策、法律與治理", /policy|law|governance|ethic|society/i],
  ["經濟與決策", /econom|finance|decision|investment/i],
  ["化學與生醫", /chemistry|biomedical|biology|medical|biochemistry/i],
  ["設計與創新", /design|innovation|interaction|creative/i],
];

function readableChinese(value) {
  return typeof value === "string" && !value.includes("\uFFFD") && /[\u3400-\u9fff]/.test(value);
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function extractAfterTabs(value) {
  return String(value ?? "").split(/\r?\n/).map((line) => clean(line.split("\t").at(-1))).filter(Boolean).join("・");
}

for (const row of source) {
  const values = Object.values(row);
  const offeringKey = clean(values[0]);
  if (offeringKey.length < 8) continue;
  const semester = offeringKey.slice(0, 5);
  const rawCode = offeringKey.slice(5).trim();
  const section = rawCode.slice(-2);
  const code = rawCode.slice(0, -2).replace(/\s+/g, " ").trim();
  const id = `nthu-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  if (!id || id === "nthu-") continue;
  const titleEn = clean(values[2]) || code;
  const titleZh = readableChinese(values[1]) ? clean(values[1]) : titleEn;
  const credits = Number(values[3]) || 0;
  const department = code.split(" ")[0] || "NTHU";
  const numberPart = code.match(/\d+/)?.[0] ?? "1";
  const level = Number(numberPart[0]) >= 5 ? "研究所" : "大學部";
  const topics = topicRules.filter(([, pattern]) => pattern.test(`${titleEn} ${titleZh}`)).map(([topic]) => topic);
  if (!topics.length) topics.push("其他領域");
  if (!courseMap.has(id)) {
    courseMap.set(id, {
      course: { id, school: "NTHU", code, titleZh, titleEn, department, credits, level, topics },
      offerings: [],
    });
  }
  courseMap.get(id).offerings.push({
    id: offeringKey,
    courseId: id,
    semester,
    section,
    teacher: extractAfterTabs(values[12]),
    language: readableChinese(values[8]) ? clean(values[8]) : "中文",
    schedule: extractAfterTabs(values[11]),
    capacity: Number(values[4]) || null,
    source: "open_course_data.json",
  });
}

const nccuPrototypeCourses = [
  { id: "nccu-sust301", code: "SUST 301", titleZh: "永續發展與公共政策", titleEn: "Sustainable Development and Public Policy", department: "公共行政學系", credits: 3, topics: ["環境與永續", "政策、法律與治理"] },
  { id: "nccu-ds205", code: "DS 205", titleZh: "資料科學與社會", titleEn: "Data Science and Society", department: "資訊科學系", credits: 3, topics: ["資料與 AI", "政策、法律與治理"] },
  { id: "nccu-law328", code: "LAW 328", titleZh: "科技、法律與社會", titleEn: "Technology, Law and Society", department: "法律學系", credits: 2, topics: ["政策、法律與治理", "資料與 AI"] },
  { id: "nccu-stat201", code: "STAT 201", titleZh: "統計學", titleEn: "Statistics", department: "統計學系", credits: 3, topics: ["資料與 AI"] },
];
for (const item of nccuPrototypeCourses) {
  courseMap.set(item.id, {
    course: { ...item, school: "NCCU", level: "大學部" },
    offerings: [{ id: `11510${item.code.replace(/\s+/g, "")}00`, courseId: item.id, semester: "11510", section: "00", teacher: "原型示範教師", language: "中文", schedule: "待確認", capacity: null, source: "NCCU prototype" }],
  });
}

const records = [...courseMap.values()].sort((a, b) => a.course.code.localeCompare(b.course.code));
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), sourceRecords: source.length, records }));
console.log(JSON.stringify({ sourceRecords: source.length, courses: records.length, offerings: records.reduce((sum, item) => sum + item.offerings.length, 0), outputPath }));
