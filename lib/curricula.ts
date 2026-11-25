type Requirement = { title: string; code?: string; alternativeCode?: string };
type Curriculum = {
  school: "NCCU" | "NTHU";
  department: string;
  year: number;
  source: string;
  required: readonly Requirement[];
  notes: readonly string[];
};

const nthuRequired: Requirement[] = [
  { title: "微積分 B 一", code: "MATH1030" },
  { title: "微積分 B 二" },
  { title: "計算機程式設計一", code: "CS1355" },
  { title: "計算機程式設計二", code: "CS1356" },
  { title: "資料結構", code: "CS2351" },
  { title: "線性代數", code: "CS2334" },
  { title: "機率", code: "CS3332" },
  { title: "離散數學", code: "CS2336" },
  { title: "邏輯設計", code: "EECS1010" },
  { title: "硬體設計與實驗", code: "CS2104" },
  { title: "軟體設計與實驗", code: "CS2410" },
  { title: "計算機結構", code: "CS4100" },
  { title: "計算方法設計", code: "CS4311" },
  { title: "作業系統", code: "CS3423" },
  { title: "系統整合實作一", code: "CS3901" },
  { title: "系統整合實作二", code: "CS3902" },
];

const nccuRequired: Requirement[] = [
  { title: "微積分" },
  { title: "計算機程式設計（一）", code: "703049" },
  { title: "物件導向程式設計" },
  { title: "線性代數" },
  { title: "機率論", code: "703017" },
  { title: "離散數學", code: "703007" },
  { title: "資料結構", code: "703008" },
  { title: "演算法" },
  { title: "程式能力檢定", code: "703056" },
  { title: "數位系統導論／實習" },
  { title: "作業系統", code: "703016" },
  { title: "計算機結構與組織", code: "703019" },
];

const nthuEeRequired: Requirement[] = [
  { title: "微積分 A 一", code: "MATH1010" },
  { title: "微積分 A 二", code: "MATH1020" },
  { title: "普通物理 B 一", code: "PHYS1133" },
  { title: "普通物理 B 二", code: "PHYS1143" },
  { title: "普通物理實驗一", code: "PHYS1010" },
  { title: "邏輯設計", code: "EECS1010" },
  { title: "計算機程式設計", code: "EE2310" },
  { title: "常微分方程", code: "EECS2030" },
  { title: "偏微分方程與複變函數", code: "EE2020" },
  { title: "線性代數", code: "EE2030", alternativeCode: "EECS2050" },
  { title: "電路學", code: "EE2210" },
  { title: "電子學一", code: "EE2250" },
  { title: "電子學二", code: "EE2260" },
  { title: "電磁學", code: "EE2140" },
  { title: "訊號與系統", code: "EECS2020" },
  { title: "機率", code: "EE3060", alternativeCode: "EECS3030" },
  { title: "電子電路實驗", code: "EE2245" },
  { title: "實作專題一", code: "EE3900" },
  { title: "實作專題二", code: "EE3910" },
];

const nthuCsNotes = [
  "基礎科學須從普通物理 B、普通化學、生命科學擇一系列，並修完該系列的一、二。",
  "校定必修、限制選修及組別條件請對照完整校方科目表。",
];
const nthuEeNotes = [
  "數理必選可從校方清單選至少 3 學分，實驗必選至少三門。",
  "線性代數及機率各可從表列兩個科號擇一，排程採目錄可配對的科號。",
];
const nccuCsNotes = ["此處列出已核對的指定科目。資訊專題、實習、領域群修及共同必修請對照校方科目表。"];

export const curricula: readonly Curriculum[] = [
  { school: "NTHU", department: "資訊工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/659336866.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "資訊工程學系", year: 114, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/846651128.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "資訊工程學系", year: 113, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/260991336.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "電機工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/505641261.pdf", required: nthuEeRequired, notes: nthuEeNotes },
  { school: "NTHU", department: "電機工程學系", year: 114, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/831316789.pdf", required: nthuEeRequired, notes: nthuEeNotes },
  { school: "NCCU", department: "資訊科學系", year: 113, source: "https://www.cs.nccu.edu.tw/uploads/regulation/tw/113course.pdf", required: nccuRequired, notes: nccuCsNotes },
  { school: "NCCU", department: "資訊科學系", year: 112, source: "https://www.cs.nccu.edu.tw/uploads/regulation/tw/112course.pdf", required: nccuRequired, notes: nccuCsNotes },
];

export function curriculumId({ school, department, year }: Curriculum) {
  return `${school}-${department}-${year}`;
}

function key(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
}

export function resolveCurriculum<T extends { school: string; code: string; title: string; level?: string }>(curriculum: Curriculum, catalog: readonly T[]) {
  const courses = catalog.filter((course) => course.school === curriculum.school && course.level === "大學部");
  return curriculum.required.map((requirement) => {
    const candidates = courses.filter((course) => {
      const code = key(course.code);
      if (requirement.code) return code === key(requirement.code)
        || (curriculum.school === "NCCU" && code.slice(0, 6) === requirement.code);
      if (key(course.title) !== key(requirement.title)) return false;
      return curriculum.school === "NTHU" || code.startsWith("703");
    });
    const backupCode = requirement.alternativeCode && key(requirement.alternativeCode);
    const backup = backupCode ? courses.filter((course) => key(course.code) === backupCode) : [];
    return { ...requirement, course: candidates.length === 1 ? candidates[0] : backup.length === 1 ? backup[0] : undefined };
  });
}
