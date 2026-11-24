import snapshot from "../data/nccu-offerings.json" with { type: "json" };
import { normalizeNccuCourseCode } from "./nccu-course-code.mjs";

type OfferingRow = [semester: string, code: string, teacher: string, slots: string, language: string, sourceUrl: string, title?: string];
const offerings = new Map(Object.entries(snapshot.courses) as [string, OfferingRow[]][]);
const courseIdsByCode = new Map<string, string[]>();
const codesByCourse = new Map<string, string[]>();
for (const [id, rows] of offerings) {
  const codes = [...new Set(rows.map((row) => row[1]))].sort();
  codesByCourse.set(id, codes);
  for (const code of codes) {
    const owners = courseIdsByCode.get(code) ?? [];
    owners.push(id);
    courseIdsByCode.set(code, owners);
  }
}

export type NccuOffering = {
  code: string;
  semester: string;
  teacher: string;
  schedule: string | null;
  language: string;
  sourceUrl: string;
  title?: string;
};

// The official timetable assigns one 50-minute slot per listed period.
const periodStarts = new Map(Object.entries({
  "1": "08:10", "2": "09:10", "3": "10:10", "4": "11:10", C: "12:10", D: "13:10",
  "5": "14:10", "6": "15:10", "7": "16:10", "8": "17:10", E: "18:10", F: "19:10", G: "20:10",
}));
const timeOrder = ["1", "2", "3", "4", "C", "D", "5", "6", "7", "8", "E", "F", "G"];

export function formatNccuSchedule(slots: string) {
  if (!slots || /^(?:未定或彈性|無資料|未定)$/u.test(slots)) return null;
  const compact = slots.replace(/[\s、，,;/；]+/gu, "");
  if (!/^(?:[一二三四五六日][1-8A-H]+)+$/u.test(compact)) return slots;
  return [...compact.matchAll(/([一二三四五六日])([1-8A-H]+)/gu)].map(([, day, periods]) => {
    const first = periodStarts.get(periods[0]);
    const last = periodStarts.get(periods[periods.length - 1]);
    const startIndex = timeOrder.indexOf(periods[0]);
    const contiguous = [...periods].every((period, index) => timeOrder[startIndex + index] === period);
    if (!first || !last || !contiguous) return `週${day}第 ${[...periods].join("、")} 節`;
    const end = `${String(Number(last.slice(0, 2)) + 1).padStart(2, "0")}:00`;
    return `週${day} ${first}–${end}`;
  }).join("、");
}

export function getNccuOfferings(courseId: string): NccuOffering[] {
  return (offerings.get(courseId) ?? []).map(([semester, code, teacher, slots, language, sourceUrl, title]) => ({
    semester, code, teacher, schedule: formatNccuSchedule(slots), language, sourceUrl, title,
  }));
}

export function getNccuOfferingCourseIds(query: string) {
  return courseIdsByCode.get(normalizeNccuCourseCode(query)) ?? [];
}

export function getNccuOfferingCodes(courseId: string) {
  return codesByCourse.get(courseId) ?? [];
}

export function getLatestNccuOfferingTerm(courseId: string) {
  return offerings.get(courseId)?.[0]?.[0];
}
