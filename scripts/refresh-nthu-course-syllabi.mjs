import { readFile, writeFile } from "node:fs/promises";

const seedPath = process.argv[2] ?? "data/course-seed.json";
const cachePath = process.argv[3] ?? "data/nthu-course-syllabus.json";
const apiBase = "https://api.nthumods.com/course";
const concurrency = Math.max(1, Math.min(30, Number(process.env.NTHU_FETCH_CONCURRENCY ?? 8)));
const batchDelayMs = Math.max(250, Number(process.env.NTHU_FETCH_DELAY_MS ?? 500));

const seed = JSON.parse(await readFile(seedPath, "utf8"));
let cached = [];
try {
  cached = JSON.parse(await readFile(cachePath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const cache = new Map(cached.map((item) => [item.rawId, item]));
const nthuRecords = seed.records.filter((item) => item.course.school === "NTHU");
const jobs = nthuRecords.map((record) => {
  const offerings = [...record.offerings].sort((a, b) => b.semester.localeCompare(a.semester) || a.id.localeCompare(b.id));
  return { record, offering: offerings[0] };
}).filter((job) => job.offering && !cache.has(job.offering.id));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCourse(rawId, attempt = 0) {
  let response;
  let data;
  try {
    response = await fetch(`${apiBase}/${encodeURIComponent(rawId)}/syllabus`, {
      headers: { accept: "application/json", "user-agent": "college-explorer-course-refresh/1.0" },
    });
    if (response.status === 404) return { rawId, missing: true, fetchedAt: new Date().toISOString() };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    if (!body.trim()) return { rawId, missing: true, fetchedAt: new Date().toISOString() };
    data = JSON.parse(body);
  } catch (error) {
    if (attempt >= 5) throw new Error(`${rawId}: ${error.message}`);
    await wait(Math.min(30_000, 1_500 * 2 ** attempt));
    return fetchCourse(rawId, attempt + 1);
  }
  if (!data?.raw_id) return { rawId, missing: true, fetchedAt: new Date().toISOString() };
  const syllabus = data.course_syllabus ?? {};
  return {
    rawId,
    brief: String(syllabus.brief ?? "").trim(),
    content: String(syllabus.content ?? "").trim(),
    keywords: Array.isArray(syllabus.keywords) ? syllabus.keywords.map((item) => String(item).trim()).filter(Boolean) : [],
    prerequisites: String(data.prerequisites ?? "").trim(),
    restrictions: String(data.restrictions ?? "").trim(),
    teachers: Array.isArray(data.teacher_zh) && data.teacher_zh.length ? data.teacher_zh : data.teacher_en ?? [],
    hasFile: Boolean(syllabus.has_file),
    sourceUpdatedAt: syllabus.updated_at ?? data.updated_at ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function saveCache() {
  const values = [...cache.values()].sort((a, b) => a.rawId.localeCompare(b.rawId));
  await writeFile(cachePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

let fetched = 0;
let failed = 0;
for (let index = 0; index < jobs.length; index += concurrency) {
  const batch = jobs.slice(index, index + concurrency);
  const results = await Promise.allSettled(batch.map((job) => fetchCourse(job.offering.id)));
  results.forEach((result, itemIndex) => {
    const rawId = batch[itemIndex].offering.id;
    if (result.status === "fulfilled") {
      cache.set(rawId, result.value);
      fetched += 1;
    } else {
      failed += 1;
      console.warn(result.reason?.message ?? `${rawId}: unknown error`);
    }
  });
  if (fetched % 60 < concurrency || index + concurrency >= jobs.length) {
    await saveCache();
    console.log(`Fetched ${Math.min(index + concurrency, jobs.length)}/${jobs.length}; cached ${cache.size}; failed ${failed}`);
  }
  if (index + concurrency < jobs.length) await wait(batchDelayMs);
}

for (const record of nthuRecords) {
  const offerings = [...record.offerings].sort((a, b) => b.semester.localeCompare(a.semester) || a.id.localeCompare(b.id));
  const detail = offerings.map((offering) => cache.get(offering.id)).find((item) => item && !item.missing);
  if (!detail) continue;
  if (detail.brief) record.course.description = detail.brief;
  if (detail.content) record.course.objectives = detail.content;
  if (detail.prerequisites || detail.restrictions) {
    record.course.prerequisites = [detail.prerequisites, detail.restrictions].filter(Boolean).join("｜");
  }
  if (detail.hasFile) record.course.syllabusUrl = `${apiBase}/${encodeURIComponent(detail.rawId)}/syllabus/file`;
  record.course.syllabusSource = "清大官方課程系統大綱（由 NTHUMods 公開索引整理）";
  if (detail.sourceUpdatedAt) record.course.syllabusUpdatedAt = detail.sourceUpdatedAt;
}

seed.generatedAt = new Date().toISOString();
seed.nthuSyllabusRecords = [...cache.values()].filter((item) => item.brief || item.content).length;
await writeFile(seedPath, `${JSON.stringify(seed)}\n`, "utf8");
await saveCache();

console.log(JSON.stringify({ nthuCourses: nthuRecords.length, requested: jobs.length, cached: cache.size, enriched: seed.nthuSyllabusRecords, failed }, null, 2));
