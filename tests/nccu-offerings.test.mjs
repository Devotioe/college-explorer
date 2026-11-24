import assert from "node:assert/strict";
import test from "node:test";
import seed from "../data/course-seed.json" with { type: "json" };
import { formatNccuSchedule, getNccuOfferings, getNccuOfferingCourseIds } from "../lib/nccu-offerings.ts";

test("keeps programming sections and their instructors tied to each semester", () => {
  const rows = getNccuOfferings("nccu-306049001");
  assert.ok(rows.some(row => row.code === "306049001" && row.semester === "114-1" && row.schedule.startsWith("週一")));
  assert.deepEqual(rows.filter(row => row.code === "306049011").slice(0, 2).map(row => [row.semester, row.teacher, row.schedule]), [
    ["115-1", "林怡伶", "週二 09:10–11:00"],
    ["114-1", "蕭舜文", "週二 09:10–11:00"],
  ]);
  assert.equal(rows.find(row => row.code === "306049001" && row.semester === "115-1").schedule, "週一 14:10–16:00");
});

test("resolves both code formats without merging another course by title", () => {
  assert.deepEqual(getNccuOfferingCourseIds("306049011"), ["nccu-306049001"]);
  assert.deepEqual(getNccuOfferingCourseIds(" ３０６０４９－０１１ "), ["nccu-306049001"]);
  assert.deepEqual(getNccuOfferingCourseIds("306047-011"), ["nccu-306047001"]);
  assert.deepEqual(getNccuOfferingCourseIds("程式設計一"), []);
  assert.ok(getNccuOfferings("nccu-703049001").every(row => row.code.startsWith("703049")));
});

test("covers every NCCU catalog course and each listed semester without duplicate section rows", () => {
  for (const { course } of seed.records.filter(({ course }) => course.school === "NCCU")) {
    const rows = getNccuOfferings(course.id);
    assert.ok(rows.length, course.code);
    for (const semester of course.offeredTerms.filter(term => /^\d{3}-[12]$/.test(term))) {
      assert.ok(rows.some(row => row.semester === semester), `${course.code} ${semester}`);
    }
    assert.equal(new Set(rows.map(({ code, semester }) => `${semester}:${code}`)).size, rows.length, course.code);
    assert.ok(rows.every(({ code }) => code.slice(0, 6) === course.code.slice(0, 6)), course.code);
  }
  assert.equal(getNccuOfferings("nccu-357912001")[0].title, "財務論文研讀");
});

test("formats official periods without guessing flexible or discontinuous hours", () => {
  assert.equal(formatNccuSchedule("二23四D5"), "週二 09:10–11:00、週四 13:10–15:00");
  assert.equal(formatNccuSchedule("二24"), "週二第 2、4 節");
  assert.equal(formatNccuSchedule("六AB1"), "週六第 A、B、1 節");
  assert.equal(formatNccuSchedule("未定或彈性"), null);
});
