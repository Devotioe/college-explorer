import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const sourceUrl = "https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json";
const rawPath = "data/open_course_data.json";
const tempPath = "data/nthu-course-seed.tmp.json";
const seedPath = "data/course-seed.json";

const response = await fetch(sourceUrl, { headers: { "user-agent": "college-explorer-course-refresh/1.0" } });
if (!response.ok) throw new Error(`清大開放資料下載失敗：HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf16le" : "utf8";
const text = bytes.subarray(encoding === "utf16le" ? 2 : 0).toString(encoding);
JSON.parse(text);
await writeFile(rawPath, text, "utf8");

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/build-course-seed.mjs", rawPath, tempPath], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`課程轉換失敗：exit ${code}`)));
});

const [current, nthu] = await Promise.all([
  readFile(seedPath, "utf8").then(JSON.parse),
  readFile(tempPath, "utf8").then(JSON.parse),
]);
const nccuRecords = current.records.filter((item) => item.course.school === "NCCU");
const merged = {
  ...current,
  generatedAt: new Date().toISOString(),
  sourceRecords: nthu.sourceRecords,
  records: [...nthu.records, ...nccuRecords],
};
await writeFile(seedPath, `${JSON.stringify(merged)}\n`, "utf8");
await unlink(tempPath);
console.log(JSON.stringify({ source: sourceUrl, nthuCourses: nthu.records.length, nccuCourses: nccuRecords.length, total: merged.records.length }, null, 2));
