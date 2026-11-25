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
