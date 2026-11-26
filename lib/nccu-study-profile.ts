type TranscriptCourse = {
  courseCode: string;
  courseName: string;
  gradeRaw: string;
  credits: number | null;
  term: string;
};

type CatalogCourse = { id: string; school: string; code: string; title: string; unit: string };
type Distribution<T extends string = string> = { name: T; count: number };
type Classification = { college: string; department?: DepartmentName };
type TeachingUnit = readonly [department: string, aliases: string, prefixes?: string];
type DepartmentMascot = Distribution<DepartmentName> & { label: string; symbol: string };
type CourseAssignment = { key: string; courseName: string; courseCode: string; college?: string; department?: DepartmentName };

export type NccuStudyProfile = {
  colleges: Distribution[];
  departments: Distribution[];
  departmentMascot: DepartmentMascot | null;
  courseAssignments: CourseAssignment[];
  titles: string[];
  unclassifiedCount: number;
  countedCount: number;
};

// Teaching unit names and affiliations: https://2024nccu.nccu.edu.tw/p/426-1000-55.php?Lang=zh-tw
// https://www.nccu.edu.tw/var/file/0/1000/img/7/748643962.pdf and https://aca.nccu.edu.tw/download/must/114/phd/463d.pdf
// Prefixes are used only for dedicated subject codes in the local NCCU catalog.
const units = [
  ["商學院", [
    ["國際經營與貿易學系", "國貿", "301 351"],
    ["金融學系", "金融", "302 352"],
    ["會計學系", "會計 會碩稅", "303 353"],
    ["統計學系", "統計", "304 354"],
    ["企業管理學系", "企管 企博產 企博學", "305 355"],
    ["資訊管理學系", "資管 資博學 資博產 資專", "306 356 971"],
    ["財務管理學系", "財管", "307 357"],
    ["風險管理與保險學系", "風管", "308 358"],
    ["企業管理研究所", "企研 MBA", "363"],
    ["科技管理與智慧財產研究所", "科管智財 科智 科博學 科博產", "364"],
  ]],
  ["社會科學學院", [
    ["政治學系", "政治 政治系", "202 252"],
    ["社會學系", "社會", "204 254"],
    ["財政學系", "財政", "205 255"],
    ["公共行政學系", "公行 行管", "206 256 921"],
    ["地政學系", "地政", "207 257 923"],
    ["經濟學系", "經濟", "208 258"],
    ["民族學系", "民族", "209 259"],
    ["國家發展研究所", "國發", "261"],
    ["勞工研究所", "勞工", "262"],
    ["社會工作研究所", "社工", "264"],
    ["亞太研究英語博士學位學程", "亞太博", "265"],
    ["亞太研究英語碩士學位學程", "亞太碩", "926"],
    ["應用經濟與社會發展英語碩士學位學程", "應社", "266"],
  ]],
  ["外國語文學院", [
    ["英國語文學系", "英文 英教", "501 551 951"],
    ["阿拉伯語文學系", "阿文", "502"],
    ["斯拉夫語文學系", "斯語", "504 554"],
    ["日本語文學系", "日文", "506 556"],
    ["韓國語文學系", "韓文", "507 557"],
    ["土耳其語文學系", "土文", "508"],
    ["歐洲語文學系", "歐文 歐文學系 歐文法 歐文德 歐文西", "509"],
    ["東南亞語文學系", "東南亞語系 東南越 東南泰 東南印", "510"],
    ["語言學研究所", "語言", "555"],
    ["中東與中亞研究碩士學位學程", "中東亞", "560"],
  ]],
  ["文學院", [
    ["中國文學系", "中文", "101 151"],
    ["歷史學系", "歷史", "103 153"],
    ["哲學系", "哲學", "104 154"],
    ["圖書資訊與檔案學研究所", "圖檔 圖資", "155 913"],
    ["宗教研究所", "宗教", "156"],
    ["台灣史研究所", "台史", "158"],
    ["台灣文學研究所", "台文", "159"],
    ["華語文教學博士學位學程", "華文博", "160"],
    ["華語文教學碩士學位學程", "華文碩 華文碩程", "161"],
  ]],
  ["傳播學院", [
    ["新聞學系", "新聞", "401"],
    ["廣告學系", "廣告", "402"],
    ["廣播電視學系", "廣電", "403"],
    ["國際傳播英語碩士學位學程", "國傳", "461"],
    ["數位內容碩士學位學程", "數位", "462"],
    ["傳播學院博士班", "傳播博", "463"],
    ["傳播學院傳播碩士學位學程", "傳播碩", "464"],
    ["亞際文化研究國際碩士學位學程", "亞際", "465"],
  ]],
  ["法學院", [
    ["法律學系", "法律", "601 651"],
    ["法律科際整合研究所", "法科", "652"],
    ["法學院碩士在職專班", "法碩專", "961"],
  ]],
  ["理學院", [
    ["應用數學系", "應數", "701 751"],
    ["心理學系", "心理", "702 752"],
    ["神經科學研究所", "神科", "754"],
    ["應用物理研究所", "應物 應用物理", "755"],
    ["電子物理學士學位學程", "電物 電物學程 電子物理", "782"],
  ]],
  ["資訊學院", [
    ["資訊科學系", "資科 資訊 資碩工 資碩計", "703 753"],
    ["社群網路與人智計算國際研究生博士學位學程", "群智", "761"],
    ["數位內容與科技學士學位學程", "數位學程", "781"],
    ["人工智慧應用學士學位學程", "人智學程 人智應 人智應學士", "783"],
    ["資訊安全碩士學位學程", "資安", "791"],
  ]],
  ["國際事務學院", [
    ["外交學系", "外交 外戰略", "203 253 922"],
    ["東亞研究所", "東亞", "260"],
    ["俄羅斯研究所", "俄研 俄羅", "263"],
    ["日本研究碩士學位學程", "日學碩", "861"],
    ["日本研究博士學位學程", "日學博", "863"],
    ["國際研究英語碩士學位學程", "國研", "862"],
  ]],
  ["教育學院", [
    ["教育學系", "教育", "102 152"],
    ["幼兒教育研究所", "幼教", "157"],
    ["教育行政與政策研究所", "教政", "171"],
    ["輔導與諮商碩士學位學程", "輔諮", "172"],
  ]],
  ["創新國際學院", [
    ["創新國際學院學士班", "創國學", "ZU1"],
    ["全球傳播與創新科技碩士學位學程", "全創", "ZM1"],
  ]],
  ["X實驗學院", [
    ["運動產業與文化學士學位學程", "運動學程", "NU1"],
  ]],
] as const satisfies readonly [college: string, units: readonly TeachingUnit[]][];

type DepartmentName = (typeof units)[number][1][number][0];

export const departmentMascots = {
  國際經營與貿易學系: { label: "國貿貨輪", symbol: "🚢" },
  金融學系: { label: "金融金幣", symbol: "🪙" },
  會計學系: { label: "會計算盤", symbol: "🧮" },
  統計學系: { label: "統計蜜蜂", symbol: "🐝" },
  企業管理學系: { label: "企管狗", symbol: "🐕" },
  資訊管理學系: { label: "資管浣熊", symbol: "🦝" },
  財務管理學系: { label: "財管松鼠", symbol: "🐿️" },
  風險管理與保險學系: { label: "風管烏龜", symbol: "🐢" },
  企業管理研究所: { label: "企研棋子", symbol: "♟️" },
  科技管理與智慧財產研究所: { label: "科管智財燈泡", symbol: "💡" },
  政治學系: { label: "政治老鷹", symbol: "🦅" },
  社會學系: { label: "社會螞蟻", symbol: "🐜" },
  財政學系: { label: "財政錢袋", symbol: "💰" },
  公共行政學系: { label: "公行海狸", symbol: "🦫" },
  地政學系: { label: "地政地圖", symbol: "🗺️" },
  經濟學系: { label: "經濟趨勢圖", symbol: "📈" },
  民族學系: { label: "民族織線", symbol: "🧶" },
  國家發展研究所: { label: "國發幼苗", symbol: "🌱" },
  勞工研究所: { label: "勞工工具", symbol: "🛠️" },
  社會工作研究所: { label: "社工水獺", symbol: "🦦" },
  亞太研究英語博士學位學程: { label: "亞太博士鯨魚", symbol: "🐋" },
  亞太研究英語碩士學位學程: { label: "亞太碩士海豚", symbol: "🐬" },
  應用經濟與社會發展英語碩士學位學程: { label: "應社橋樑", symbol: "🌉" },
  英國語文學系: { label: "英文字母", symbol: "🔤" },
  阿拉伯語文學系: { label: "阿文駱駝", symbol: "🐪" },
  斯拉夫語文學系: { label: "斯語棕熊", symbol: "🐻" },
  日本語文學系: { label: "日文富士山", symbol: "🗻" },
  韓國語文學系: { label: "韓文老虎", symbol: "🐯" },
  土耳其語文學系: { label: "土文貓", symbol: "🐈" },
  歐洲語文學系: { label: "歐文狐狸", symbol: "🦊" },
  東南亞語文學系: { label: "東南亞棕櫚樹", symbol: "🌴" },
  語言學研究所: { label: "語言鸚鵡", symbol: "🦜" },
  中東與中亞研究碩士學位學程: { label: "中東亞沙漠", symbol: "🏜️" },
  中國文學系: { label: "中文墨筆", symbol: "🖋️" },
  歷史學系: { label: "歷史沙漏", symbol: "⏳" },
  哲學系: { label: "哲學貓頭鷹", symbol: "🦉" },
  圖書資訊與檔案學研究所: { label: "圖檔檔案櫃", symbol: "🗄️" },
  宗教研究所: { label: "宗教燭燈", symbol: "🕯️" },
  台灣史研究所: { label: "台史陶甕", symbol: "🏺" },
  台灣文學研究所: { label: "台文羽毛", symbol: "🪶" },
  華語文教學博士學位學程: { label: "華教博士卷軸", symbol: "📜" },
  華語文教學碩士學位學程: { label: "華教碩士對話框", symbol: "💬" },
  新聞學系: { label: "新聞報紙", symbol: "🗞️" },
  廣告學系: { label: "廣告擴音器", symbol: "📣" },
  廣播電視學系: { label: "廣電攝影機", symbol: "📹" },
  國際傳播英語碩士學位學程: { label: "國傳地球網格", symbol: "🌐" },
  數位內容碩士學位學程: { label: "數位內容調色盤", symbol: "🎨" },
  傳播學院博士班: { label: "傳播博士天線", symbol: "📡" },
  傳播學院傳播碩士學位學程: { label: "傳播碩士麥克風", symbol: "🎙️" },
  亞際文化研究國際碩士學位學程: { label: "亞際摺扇", symbol: "🪭" },
  法律學系: { label: "法律天平", symbol: "⚖️" },
  法律科際整合研究所: { label: "法科拼圖", symbol: "🧩" },
  法學院碩士在職專班: { label: "法碩法典", symbol: "📖" },
  應用數學系: { label: "應數章魚", symbol: "🐙" },
  心理學系: { label: "心理刺蝟", symbol: "🦔" },
  神經科學研究所: { label: "神科大腦", symbol: "🧠" },
  應用物理研究所: { label: "物理蘋果", symbol: "🍎" },
  電子物理學士學位學程: { label: "電物閃電", symbol: "⚡" },
  資訊科學系: { label: "資科企鵝", symbol: "🐧" },
  社群網路與人智計算國際研究生博士學位學程: { label: "群智蜘蛛", symbol: "🕷️" },
  數位內容與科技學士學位學程: { label: "數位遊戲手把", symbol: "🎮" },
  人工智慧應用學士學位學程: { label: "人智機器人", symbol: "🤖" },
  資訊安全碩士學位學程: { label: "資安盾牌", symbol: "🛡️" },
  外交學系: { label: "外交和平鴿", symbol: "🕊️" },
  東亞研究所: { label: "東亞燈籠", symbol: "🏮" },
  俄羅斯研究所: { label: "俄研雪花", symbol: "❄️" },
  日本研究碩士學位學程: { label: "日研櫻花", symbol: "🌸" },
  日本研究博士學位學程: { label: "日研博士鳥居", symbol: "⛩️" },
  國際研究英語碩士學位學程: { label: "國研指南針", symbol: "🧭" },
  教育學系: { label: "教育象", symbol: "🐘" },
  幼兒教育研究所: { label: "幼教兔子", symbol: "🐇" },
  教育行政與政策研究所: { label: "教政紀錄板", symbol: "📋" },
  輔導與諮商碩士學位學程: { label: "輔諮擁抱", symbol: "🫂" },
  創新國際學院學士班: { label: "創國火箭", symbol: "🚀" },
  全球傳播與創新科技碩士學位學程: { label: "全創衛星", symbol: "🛰️" },
  運動產業與文化學士學位學程: { label: "運動跑鞋", symbol: "👟" },
} satisfies Record<DepartmentName, { label: string; symbol: string }>;

export const mascotGroups = units.map(([college, departments]) => ({
  college,
  mascots: departments.map(([department]) => ({ department, ...departmentMascots[department] })),
}));

export function mascotIconPath(symbol: string, directory: "mascot-icons" | "mascot-results" = "mascot-icons") {
  const code = [...symbol.replace(/[\uFE0E\uFE0F]/gu, "")]
    .map((character) => character.codePointAt(0)!.toString(16)).join("-");
  return `/${directory}/${code}.png`;
}

const collegeAliases: Record<string, string> = {
  文院: "文學院",
  社科院: "社會科學學院",
  商院: "商學院",
  傳院: "傳播學院",
  傳播院: "傳播學院",
  傳播院學: "傳播學院",
  外語學院: "外國語文學院",
  外文中: "外國語文學院",
  外文中心: "外國語文學院",
  國務院: "國際事務學院",
  教院: "教育學院",
  創國學院: "創新國際學院",
  X實驗學士: "X實驗學院",
};

const colleges = [...units.map(([college]) => college), "國際金融學院"];
const aliases = units.flatMap(([college, departments]) => departments.flatMap(([department, shortNames]) =>
  [department, ...shortNames.split(" ")].map((name) => ({ name, college, department })),
)).sort((a, b) => b.name.length - a.name.length);
const prefixes = new Map(units.flatMap(([college, departments]) => departments.flatMap(([department, , codes]) =>
  codes ? codes.split(" ").map((code) => [code, { college, department }] as const) : [],
)));

function normalizeName(value: string) {
  return value.normalize("NFKC").toLowerCase().replaceAll("臺", "台").replace(/[\s\p{P}\p{S}]/gu, "");
}

function normalizeCode(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[\s-]/gu, "");
}

function courseFamily(code: string) {
  return /^[A-Z0-9]{6}(?:\d{3})?$/.test(code) ? code.slice(0, 6) : code;
}

function startsWithUnit(label: string, unit: string) {
  const name = normalizeName(unit);
  return label === name || (label.startsWith(name) && /^[一二三四五六七八九十甲乙丙丁碩博士班選系所\d]/u.test(label.slice(name.length)));
}

function matchesCollegeLabel(label: string, unit: string) {
  if (startsWithUnit(label, unit)) return true;
  const name = normalizeName(unit);
  return name.endsWith("院") && (label === `${name}學士` || label === `${name}學士班`);
}

function classifyCourse(course: CatalogCourse): Classification | undefined {
  const labels = course.unit.normalize("NFKC").split(/[,、;\/|]/u).map(normalizeName).filter(Boolean);
  const classifications = labels.map((label) => {
    const department = aliases.find(({ name }) => startsWithUnit(label, name));
    if (department) return { college: department.college, department: department.department };
    const college = colleges.find((name) => matchesCollegeLabel(label, name));
    const alias = Object.entries(collegeAliases).find(([name]) => matchesCollegeLabel(label, name));
    return college || alias ? { college: college ?? alias![1] } : undefined;
  });
  if (!classifications.some(Boolean)) return prefixes.get(normalizeCode(course.code).slice(0, 3));
  if (classifications.includes(undefined)) return undefined;
  const collegeNames = new Set(classifications.map((classification) => classification?.college));
  if (collegeNames.size !== 1) return undefined;
  const departmentNames = new Set(classifications.map((classification) => classification?.department));
  return { college: classifications[0]!.college, department: departmentNames.size === 1 ? classifications[0]!.department : undefined };
}

function courseKey(course: CatalogCourse) {
  const code = courseFamily(normalizeCode(course.code));
  return code ? JSON.stringify([code, normalizeName(course.title), normalizeName(course.unit)]) : course.id;
}

function soleCourse<T extends CatalogCourse>(candidates: readonly T[]) {
  return new Set(candidates.map(courseKey)).size === 1 ? candidates[0] : undefined;
}

function indexCourses<T extends CatalogCourse>(courses: readonly T[], getKey: (course: T) => string) {
  const matches = new Map<string, T[]>();
  for (const course of courses) {
    const key = getKey(course);
    const existing = matches.get(key);
    if (existing) existing.push(course);
    else matches.set(key, [course]);
  }
  return matches;
}

function gradeCountsAsTaken(grade: string) {
  const value = grade.normalize("NFKC").toUpperCase().replace(/[\s\p{P}\p{S}]/gu, "");
  return Boolean(value) && !/^(?:W(?:退選|停修|撤選|WITHDRAWN)?|WITHDRAWN|WITHDRAWAL|退選|撤選|停修|棄修|已退選|I|IP|INCOMPLETE|INPROGRESS|PENDING|修課中|修習中|修讀中|選修中|在修|未修畢|未完成|成績未定|尚未登錄|未登錄|未評分|未送出|未公布|待補|待定|待登錄|NA)$/u.test(value);
}

function orderedCounts<T extends string>(counts: Map<T, number>): Distribution<T>[] {
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"));
}

function uniqueLeader<T extends string>(counts: Distribution<T>[]) {
  const [first, second] = counts;
  return first && first.count > (second?.count ?? 0) ? first : undefined;
}

export function buildNccuStudyProfile<T extends CatalogCourse>(rows: readonly TranscriptCourse[], catalog: readonly T[]): NccuStudyProfile {
  const nccu = catalog.filter((course) => course.school === "NCCU");
  const otherCodes = new Set(catalog.filter((course) => course.school !== "NCCU").map((course) => normalizeCode(course.code)));
  const byCode = indexCourses(nccu, (course) => normalizeCode(course.code));
  const byFamily = indexCourses(nccu, (course) => courseFamily(normalizeCode(course.code)));
  const byTitle = indexCourses(nccu, (course) => normalizeName(course.title));
  const collegeCounts = new Map<string, number>();
  const departmentCounts = new Map<DepartmentName, number>();
  const courseAssignments: CourseAssignment[] = [];
  const seen = new Set<string>();
  let unclassifiedCount = 0;

  for (const row of rows) {
    if (!gradeCountsAsTaken(row.gradeRaw)) continue;
    const code = normalizeCode(row.courseCode);
    const family = courseFamily(code);
    const title = normalizeName(row.courseName);
    if (!code && !title) continue;

    const candidates = code ? (byCode.get(code) ?? byFamily.get(family)) : undefined;
    let course: T | undefined;
    if (candidates) {
      // A contradictory title can come from an OCR suggestion for the wrong course.
      course = soleCourse(title ? candidates.filter((candidate) => normalizeName(candidate.title) === title) : candidates);
    } else if (title && (!code || !otherCodes.has(code))) {
      course = soleCourse(byTitle.get(title) ?? []);
    }

    const key = course ? `catalog:${courseKey(course)}` : `unmatched:${JSON.stringify([family, title])}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const classification = course && classifyCourse(course);
    courseAssignments.push({
      key,
      courseName: course?.title ?? row.courseName,
      courseCode: course?.code ?? row.courseCode,
      ...classification,
    });
    if (!classification) {
      unclassifiedCount++;
      continue;
    }
    const { college, department } = classification;
    collegeCounts.set(college, (collegeCounts.get(college) ?? 0) + 1);
    if (department) departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
  }

  const rankedColleges = orderedCounts(collegeCounts);
  const rankedDepartments = orderedCounts(departmentCounts);
  const leadingCollege = uniqueLeader(rankedColleges)?.name;
  const leadingDepartment = uniqueLeader(rankedDepartments);
  const departmentMascot = leadingDepartment ? { ...leadingDepartment, ...departmentMascots[leadingDepartment.name] } : null;
  const titles: string[] = [];
  if (leadingCollege === "商學院") titles.push("商院狗");
  if (leadingCollege === "外國語文學院") titles.push("語文貓");
  if (departmentMascot && ["企業管理學系", "應用物理研究所", "電子物理學士學位學程"].includes(departmentMascot.name)) {
    titles.push(departmentMascot.label);
  }

  return { colleges: rankedColleges, departments: rankedDepartments, departmentMascot, courseAssignments, titles, unclassifiedCount, countedCount: seen.size };
}
