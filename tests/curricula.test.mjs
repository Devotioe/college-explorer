import assert from "node:assert/strict";
import test from "node:test";
import { curricula, curriculumId, resolveCurriculum } from "../lib/curricula.ts";

test("same-year requirements stay separate by department and use the published course codes", () => {
  const cs = curricula.find(({ year, department }) => year === 115 && department === "資訊工程學系");
  const ee = curricula.find(({ year, department }) => year === 115 && department === "電機工程學系");
  assert.notEqual(curriculumId(cs), curriculumId(ee));
  const catalog = [
    { school: "NTHU", level: "大學部", code: "CS 2334", title: "線性代數" },
    { school: "NTHU", level: "大學部", code: "EECS2050", title: "線性代數" },
    { school: "NCCU", level: "大學部", code: "EE 2030", title: "線性代數" },
  ];
  const requiredCode = (curriculum) => resolveCurriculum(curriculum, catalog).find(({ title }) => title === "線性代數").course?.code;
  assert.equal(requiredCode(cs), "CS 2334");
  assert.equal(requiredCode(ee), "EECS2050");
});

test("keeps new department records scoped to verified cohorts and course families", () => {
  const mis = curricula.find(({ year, department }) => year === 113 && department === "資訊管理學系");
  const math = curricula.find(({ year, department }) => year === 115 && department === "數學系");
  const catalog = [
    { school: "NCCU", level: "大學部", code: "306013001", title: "資料結構" },
    { school: "NCCU", level: "大學部", code: "703008001", title: "資料結構" },
    { school: "NTHU", level: "大學部", code: "EECS2000", title: "線性代數二" },
    { school: "NTHU", level: "大學部", code: "MATH 1420", title: "線性代數二" },
  ];
  const dataStructures = resolveCurriculum(mis, catalog).find(({ title }) => title === "資料結構");
  assert.equal(dataStructures.course.code, "306013001");
  assert.equal(dataStructures.semester, 3);
  assert.equal(resolveCurriculum(math, catalog).find(({ title }) => title === "線性代數二").course.code, "MATH 1420");
  assert.deepEqual(curricula.filter(({ department }) => department === "風險管理與保險學系").map(({ year }) => year), [115, 114, 113]);
});
