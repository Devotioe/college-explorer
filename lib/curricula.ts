type Requirement = { title: string; code?: string; alternativeCode?: string; codePrefix?: string; semester?: number };
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

const nthuScienceBasics: Requirement[] = [
  { title: "微積分 B 一", code: "MATH1030" }, { title: "微積分 B 二" },
  { title: "普通物理 B 一", code: "PHYS1133" }, { title: "普通物理 B 二", code: "PHYS1143" },
  { title: "普通物理實驗一", code: "PHYS1010" }, { title: "普通物理實驗二", codePrefix: "PHYS" },
  { title: "普通化學一", code: "CHEM1010" }, { title: "普通化學二", codePrefix: "CHEM" },
  { title: "普通化學實驗一", code: "CHEM1030" }, { title: "普通化學實驗二", codePrefix: "CHEM" },
];

const nthuChemical: Requirement[] = [
  ...nthuScienceBasics,
  { title: "工程數學一", code: "CHE2110" }, { title: "工程數學二", codePrefix: "CHE" },
  { title: "有機化學一", code: "CHEM2210" }, { title: "有機化學二", codePrefix: "CHEM" },
  { title: "有機化學實驗一", code: "CHEM2230" }, { title: "有機化學實驗二", codePrefix: "CHEM" },
  { title: "物理化學一", code: "CHE2410" }, { title: "物理化學二", codePrefix: "CHE" },
  { title: "物理化學實驗一" }, { title: "物理化學實驗二" },
  { title: "輸送現象及單元操作一", code: "CHE3520" }, { title: "輸送現象及單元操作二", codePrefix: "CHE" },
  { title: "資訊系統應用" }, { title: "化學工程導論", code: "CHE1160" }, { title: "工程導論", code: "E1001" },
  { title: "質能均衡", codePrefix: "CHE" }, { title: "化工熱力學", code: "CHE3030" }, { title: "化學反應工程", code: "CHE3070" },
  { title: "單元操作實驗", code: "CHE4210" }, { title: "生物技術概論", code: "CHE4552" },
  { title: "儀器分析及實驗一", code: "CHE3090" }, { title: "化工單操", codePrefix: "CHE" },
  { title: "程序控制", codePrefix: "CHE" }, { title: "程序設計", code: "CHE4150" },
];

const nthuMaterials: Requirement[] = [
  ...nthuScienceBasics.map((item) => item.code === "CHEM1010" ? { ...item, code: "MS1031" } : item),
  { title: "材料科學與工程一", code: "MS1021" }, { title: "材料科學與工程二", codePrefix: "MS" },
  { title: "工程數學一", code: "MS2011" }, { title: "工程數學二", codePrefix: "MS" },
  { title: "材料熱力學一", code: "MS2021" }, { title: "材料熱力學二", codePrefix: "MS" },
  { title: "晶體缺陷", codePrefix: "MS" }, { title: "擴散與相變化", codePrefix: "MS" },
  { title: "材料實驗一", code: "MS3003" }, { title: "材料實驗二", code: "MS3032" },
  { title: "材料科技論壇", code: "MS3011" }, { title: "工程導論", code: "E1001" },
  { title: "機械性質", code: "MS3021" }, { title: "材料之物理性質", codePrefix: "MS" }, { title: "結晶繞射概論", code: "MS2041" },
];

const nthuPowerMechanical: Requirement[] = [
  { title: "微積分 B 一", code: "MATH1030" }, { title: "微積分 B 二" },
  { title: "工程數學一", code: "PME2001" }, { title: "工程數學二", codePrefix: "PME" },
  { title: "基礎熱流學一", code: "PME2103" }, { title: "基礎熱流學二", codePrefix: "PME" },
  { title: "應用力學一", codePrefix: "PME" }, { title: "應用力學二", codePrefix: "PME" },
  { title: "專題研究一", code: "PME4003" }, { title: "專題研究二", code: "PME4002" },
  { title: "固體力學與奈米材料實驗", codePrefix: "PME" }, { title: "熱流與動力系統實驗", code: "PME4013" },
  { title: "普通化學乙", code: "CHEM1000" }, { title: "普通化學實驗", codePrefix: "CHEM" },
  { title: "程式設計", code: "PME1018" }, { title: "工程導論", code: "E1001" },
  { title: "工程圖學", code: "PME1013" }, { title: "工場實習", code: "PME1015" }, { title: "電路學", code: "PME2201" },
  { title: "電子學一", codePrefix: "PME" }, { title: "電子電路實驗一", codePrefix: "PME" },
  { title: "材料力學", code: "PME2350" }, { title: "機械製造", code: "PME2431" }, { title: "機械設計", code: "PME3433" },
  { title: "材料科學導論", codePrefix: "PME" },
];

const nthuMath: Requirement[] = [
  { title: "普通物理 A 一", code: "PHYS1134" }, { title: "普通物理 A 二", codePrefix: "PHYS" },
  { title: "程式設計一", code: "MATH1710" }, { title: "線性代數一", code: "MATH1410" }, { title: "線性代數二", codePrefix: "MATH" },
  { title: "微積分一（數學系）", code: "MATH1010" }, { title: "微積分二（數學系）", codePrefix: "MATH" },
  { title: "高等微積分一", code: "MATH2010" }, { title: "高等微積分二", codePrefix: "MATH" },
  { title: "代數一", code: "MATH2410" }, { title: "微分方程", code: "MATH3010" }, { title: "複變數函數論一", codePrefix: "MATH" },
];

const nccuMis: Requirement[] = [
  { title: "經濟學", code: "000219", semester: 1 }, { title: "初級會計學（一）", code: "000314", semester: 1 },
  { title: "計算機概論", code: "306005", semester: 1 }, { title: "程式設計一", code: "306049", semester: 1 },
  { title: "微積分", code: "000712", semester: 2 }, { title: "初級會計學（二）", code: "000318", semester: 2 },
  { title: "程式設計二", codePrefix: "306", semester: 2 }, { title: "系統分析與設計", code: "306009", semester: 3 },
  { title: "統計學（一）", code: "000359", semester: 3 }, { title: "資料結構", code: "306013", semester: 3 },
  { title: "資訊管理", code: "306047", semester: 3 }, { title: "商事法", code: "000604", semester: 4 },
  { title: "資料庫管理", codePrefix: "306", semester: 4 }, { title: "管理科學", codePrefix: "306", semester: 4 },
  { title: "企業資料通訊", code: "306007", semester: 5 }, { title: "資訊系統專案設計", code: "306016", semester: 5 },
  { title: "企業倫理與社會責任", code: "000361", semester: 7 }, { title: "管理學", code: "000348" },
];

const nccuPolitics: Requirement[] = [
  { title: "政治學", code: "000226", alternativeCode: "000211011", semester: 1 },
  { title: "政治哲學概論", code: "202035", semester: 1 }, { title: "統計學", codePrefix: "202", semester: 2 },
  { title: "中華民國憲法及政府", code: "202002", semester: 3 }, { title: "比較政府與政治", code: "202003", semester: 3 },
  { title: "政治學方法論", codePrefix: "202", semester: 4 },
];

const nccuRisk: Requirement[] = [
  { title: "微積分", code: "308002", semester: 1 }, { title: "經濟學", code: "000219", semester: 1 },
  { title: "民法概要", code: "308003", semester: 1 }, { title: "初級會計學（一）", code: "000314", semester: 1 },
  { title: "保險學", code: "308001", semester: 1 }, { title: "企業倫理與社會責任", code: "000361" },
  { title: "風險管理", code: "308044", semester: 3 }, { title: "人壽保險", code: "308016", semester: 3 },
  { title: "統計學（一）", code: "000359", semester: 3 }, { title: "財產保險", codePrefix: "308", semester: 4 },
  { title: "統計學（二）", code: "000360", semester: 4 }, { title: "保險契約法", code: "308041", semester: 5 },
  { title: "精算數學", code: "308043", semester: 5 }, { title: "再保險", codePrefix: "308", semester: 6 },
  { title: "社會保險", codePrefix: "308", semester: 6 }, { title: "退休金制度管理與理財規劃", code: "308020", semester: 7 },
];

export const curricula: readonly Curriculum[] = [
  { school: "NTHU", department: "資訊工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/659336866.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "資訊工程學系", year: 114, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/846651128.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "資訊工程學系", year: 113, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/260991336.pdf", required: nthuRequired, notes: nthuCsNotes },
  { school: "NTHU", department: "電機工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/505641261.pdf", required: nthuEeRequired, notes: nthuEeNotes },
  { school: "NTHU", department: "電機工程學系", year: 114, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/831316789.pdf", required: nthuEeRequired, notes: nthuEeNotes },
  { school: "NCCU", department: "資訊科學系", year: 113, source: "https://www.cs.nccu.edu.tw/uploads/regulation/tw/113course.pdf", required: nccuRequired, notes: nccuCsNotes },
  { school: "NCCU", department: "資訊科學系", year: 112, source: "https://www.cs.nccu.edu.tw/uploads/regulation/tw/112course.pdf", required: nccuRequired, notes: nccuCsNotes },
  { school: "NTHU", department: "化學工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/182918201.pdf",
    required: nthuChemical, notes: ["儀器分析及實驗一可按校方規定以分析化學一、二替代。光電材料與元件基礎、能源科技與環境概論須擇一。"] },
  { school: "NTHU", department: "材料科學工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/362546668.pdf",
    required: nthuMaterials, notes: ["金屬、電子、陶瓷、高分子及生醫材料五門須選三門。專業選修及學分門檻請對照校方規定。"] },
  { school: "NTHU", department: "動力機械工程學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/248184120.pdf",
    required: nthuPowerMechanical, notes: ["微積分可選 A 或 B 系列。物理五選二及專業學程請對照校方規定。"] },
  { school: "NTHU", department: "數學系", year: 115, source: "https://registra.site.nthu.edu.tw/var/file/211/1211/img/76/910866532.pdf",
    required: nthuMath, notes: ["地圖列出兩組共同的指定科目。擇一條件及數學組、應用數學組的分組必修請對照校方科目表。"] },
  { school: "NCCU", department: "資訊管理學系", year: 113, source: "https://mis2.nccu.edu.tw/zh_tw/News/學士班必修課選課須知-80247354",
    required: nccuMis, notes: ["管理學可在大一至大四修習。資訊系統專案設計從大三上標示起修，須連續修三學期。群修及認列班別請對照系方公告。"] },
  ...[115, 114, 113].map((year): Curriculum => ({
    school: "NCCU", department: "政治學系", year, source: "https://politics.nccu.edu.tw/PageDoc/Detail?fid=5161&id=28787",
    required: nccuPolitics, notes: ["全學年科目標示起修學期。比較政府與政治須先修政治學，政治學方法論須先修統計學。群修條件請對照校方科目表。"],
  })),
  ...[115, 114, 113].map((year): Curriculum => ({
    school: "NCCU", department: "風險管理與保險學系", year, source: "https://rmi.nccu.edu.tw/zh_tw/Curriculum/Curriculum1/course1",
    required: nccuRisk, notes: ["全學年科目標示起修學期。必修的開課院系、群修及抵免條件請對照系方規定。"],
  })),
  ...[112, 111, 110].map((year): Curriculum => ({
    school: "NCCU", department: "風險管理與保險學系", year, source: "https://rmi.nccu.edu.tw/zh_tw/Curriculum/Curriculum1/course1",
    required: nccuRisk.map((item) => {
      if (item.title === "風險管理") return { ...item, semester: 2 };
      if (year < 112 && item.title === "企業倫理與社會責任") return { title: "社會責任與倫理" };
      return item;
    }), notes: ["全學年科目標示起修學期。必修的開課院系、群修及抵免條件請對照系方規定。"],
  })),
];

export function nccuRequirementTableUrl(year?: string | null) {
  const academicYear = year && /^\d{2,3}$/u.test(year) ? year : "115";
  return `https://moltke.nccu.edu.tw/tsreqsub_SSO/reqsubmain.jsp?selyy=${academicYear}&colnum=1`;
}

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
      if (requirement.codePrefix) return code.startsWith(key(requirement.codePrefix));
      return curriculum.school === "NTHU" || code.startsWith("703");
    });
    const backupCode = requirement.alternativeCode && key(requirement.alternativeCode);
    const backup = backupCode ? courses.filter((course) => key(course.code) === backupCode) : [];
    return { ...requirement, course: candidates.length === 1 ? candidates[0] : backup.length === 1 ? backup[0] : undefined };
  });
}
