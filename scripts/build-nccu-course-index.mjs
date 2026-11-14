import fs from "node:fs/promises";

const inputPath = process.argv[2] ?? "data/nccu_courses/nccu_course_history.csv";
const outputPath = process.argv[3] ?? "data/nccu-course-index.json";
const detailsOutputPath = process.argv[4] ?? "data/nccu-course-details.json";

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const rows = parseCsv(await fs.readFile(inputPath, "utf8"));
const details = rows.map((row) => ({
  code: row["代表科目代碼"],
  title: row["科目名稱"],
  titleEn: row["英文科目名稱"],
  credits: Number(row["學分數"]) || null,
  department: row["開課系級(115-1)"],
  language: row["授課語文(115-1)"],
  requirement: row["修別(115-1)"],
  offeredTerms: row["曾經開過學期"].split(",").map((value) => value.trim()).filter(Boolean),
  prerequisites: row["選課設定_先修擋修"],
  teachers: row["歷年授課教師"],
  description: row["課程簡介"],
  objectives: row["課程目標與學習成效"],
  syllabusSource: row["大綱來源(最新學年/上)"],
  syllabusUrl: row["查詢網址"],
}));
const index = details.map((item) => ({
  code: item.code,
  title: item.title,
  titleEn: item.titleEn,
  credits: item.credits,
  department: item.department,
  language: item.language,
  requirement: item.requirement,
  offeredTerms: item.offeredTerms,
  prerequisites: item.prerequisites,
}));
await fs.writeFile(outputPath, JSON.stringify(index));
await fs.writeFile(detailsOutputPath, JSON.stringify(details));
console.log(`Wrote ${index.length} NCCU match records to ${outputPath} and details to ${detailsOutputPath}`);
