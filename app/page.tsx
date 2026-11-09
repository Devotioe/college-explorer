"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Compass,
  GitCompareArrows,
  GraduationCap,
  Heart,
  History,
  Info,
  Languages,
  Map,
  Network,
  Search,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Pencil,
  University,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type School = "NTHU" | "NCCU";
type Course = {
  id: string;
  school: School;
  code: string;
  title: string;
  titleEn: string;
  unit: string;
  credits: number;
  level: "大學部" | "研究所";
  language: "中文" | "英文";
  time: string;
  teacher: string;
  tags: string[];
  semanticTerms?: string[];
  summary: string;
  fit: number;
  reasons: { label: string; value: number; note: string }[];
  source: "附件資料" | "政大原型示範" | "原型語意示範";
};

const courses: Course[] = [
  {
    id: "nthu-cs1001", school: "NTHU", code: "CS 1001", title: "程式設計一",
    titleEn: "Introduction to Programming I", unit: "資訊工程學系", credits: 3,
    level: "大學部", language: "中文", time: "二 09:00–12:00", teacher: "原型示範教師",
    tags: ["程式設計", "運算思維", "軟體開發"],
    semanticTerms: ["app", "application", "mobile", "行動應用", "手機應用", "軟體", "coding", "programming", "開發"],
    summary: "從運算思維、變數、流程控制到函式，建立開發 App 與軟體產品所需的第一層程式基礎。",
    fit: 92,
    reasons: [
      { label: "語意意圖", value: 98, note: "APP 通常需要程式設計與軟體開發基礎" },
      { label: "能力起點", value: 95, note: "適合作為應用開發學習路徑的第一門課" },
      { label: "實作導向", value: 90, note: "可銜接資料結構、網頁與行動應用課程" },
      { label: "時間適配", value: 84, note: "週二上午目前沒有收藏課衝堂" },
    ], source: "原型語意示範",
  },
  {
    id: "nthu-aes4701", school: "NTHU", code: "AES 4701", title: "環境科學與工程",
    titleEn: "Environmental Science and Engineering", unit: "分析與環境科學研究所", credits: 3,
    level: "大學部", language: "中文", time: "四 15:30–18:20", teacher: "吳劍侯",
    tags: ["永續", "環境治理", "工程"],
    summary: "從環境系統、污染控制與工程方法理解永續議題，適合想把科學分析連到政策實作的學生。",
    fit: 94,
    reasons: [
      { label: "興趣相符", value: 96, note: "符合你設定的永續與公共議題偏好" },
      { label: "能力銜接", value: 90, note: "延伸已修習的普通化學與資料分析" },
      { label: "時間適配", value: 98, note: "不與目前收藏課表衝堂" },
      { label: "跨域價值", value: 92, note: "可連結環境政策與工程兩個領域" },
    ], source: "附件資料",
  },
  {
    id: "nccu-sust301", school: "NCCU", code: "SUST 301", title: "永續發展與公共政策",
    titleEn: "Sustainable Development and Public Policy", unit: "公共行政學系", credits: 3,
    level: "大學部", language: "中文", time: "二 13:10–16:00", teacher: "示範教師",
    tags: ["永續", "公共政策", "治理"],
    summary: "以政策工具、利害關係人與治理框架分析永續轉型，作為跨校相似課比較的示範課程。",
    fit: 91,
    reasons: [
      { label: "興趣相符", value: 95, note: "與永續及社會影響偏好高度吻合" },
      { label: "能力銜接", value: 86, note: "適合已有社會科學基礎的學生" },
      { label: "時間適配", value: 90, note: "週二下午仍有可用時段" },
      { label: "跨校新穎性", value: 94, note: "補足清大工程課較少涵蓋的政策觀點" },
    ], source: "政大原型示範",
  },
  {
    id: "nthu-chem1000", school: "NTHU", code: "CHEM 1000", title: "普通化學乙",
    titleEn: "General Chemistry (B)", unit: "化學系", credits: 3, level: "大學部", language: "中文",
    time: "一 10:10–12:00・三 08:00–09:50", teacher: "黃暄益", tags: ["化學", "基礎科學", "實驗思維"],
    summary: "建立化學反應、物質結構與定量推理基礎，是環境、生醫與材料領域的重要先備能力。",
    fit: 86,
    reasons: [
      { label: "能力補強", value: 93, note: "補足環境科學路徑的化學基礎" },
      { label: "興趣相符", value: 78, note: "與永續主題間接相關" },
      { label: "時間適配", value: 84, note: "週三上午已有一門收藏課接近" },
      { label: "路徑重要性", value: 90, note: "是多門進階課程的概念基礎" },
    ], source: "附件資料",
  },
  {
    id: "nccu-ds205", school: "NCCU", code: "DS 205", title: "資料科學與社會",
    titleEn: "Data Science and Society", unit: "資訊科學系", credits: 3, level: "大學部", language: "中文",
    time: "三 14:10–17:00", teacher: "示範教師", tags: ["資料科學", "AI", "社會影響"],
    summary: "用資料分析理解公共議題，同時討論偏誤、隱私與演算法治理。",
    fit: 89,
    reasons: [
      { label: "興趣相符", value: 92, note: "同時命中資料與社會影響兩項偏好" },
      { label: "能力銜接", value: 88, note: "可延伸你已收藏的統計入門" },
      { label: "時間適配", value: 85, note: "與週三上午課程無衝突" },
      { label: "跨域價值", value: 93, note: "連結技術實作與治理議題" },
    ], source: "政大原型示範",
  },
  {
    id: "nthu-bmes1111", school: "NTHU", code: "BMES 1111", title: "生醫工程與環境科學導論",
    titleEn: "Introduction to Biomedical Engineering and Environmental Sciences", unit: "生醫工程與環境科學系",
    credits: 2, level: "大學部", language: "中文", time: "一 15:30–18:20", teacher: "陳之碩、黃郁棻",
    tags: ["生醫", "環境", "跨領域"], summary: "以案例導入生醫工程、環境科學與跨領域研究方法，適合探索方向中的學生。",
    fit: 84,
    reasons: [
      { label: "探索價值", value: 94, note: "一次比較生醫與環境兩條方向" },
      { label: "興趣相符", value: 82, note: "符合環境偏好，生醫為新領域" },
      { label: "時間適配", value: 88, note: "週一下午目前沒有衝堂" },
      { label: "難度適配", value: 76, note: "導論課難度低於你的偏好設定" },
    ], source: "附件資料",
  },
  {
    id: "nccu-lawtech", school: "NCCU", code: "LAW 328", title: "科技、法律與社會",
    titleEn: "Technology, Law and Society", unit: "法律學系", credits: 2, level: "大學部", language: "中文",
    time: "五 10:10–12:00", teacher: "示範教師", tags: ["科技法律", "AI", "倫理"],
    summary: "以平台、人工智慧與資料治理案例，理解科技創新如何改變權利與制度。",
    fit: 82,
    reasons: [
      { label: "跨域價值", value: 96, note: "補足技術課程之外的法律視角" },
      { label: "興趣相符", value: 84, note: "符合 AI 社會影響偏好" },
      { label: "時間適配", value: 80, note: "週五上午可排入，但通勤緩衝較短" },
      { label: "能力銜接", value: 70, note: "需適應法律案例閱讀" },
    ], source: "政大原型示範",
  },
  {
    id: "nthu-econ101", school: "NTHU", code: "ECON 1010", title: "經濟學原理",
    titleEn: "Principles of Economics", unit: "經濟學系", credits: 3, level: "大學部", language: "英文",
    time: "二 10:10–12:00・四 10:10–11:00", teacher: "示範教師", tags: ["經濟", "決策", "社會科學"],
    summary: "以供需、誘因與市場失靈建立分析框架，可支援政策與永續議題的判斷。",
    fit: 78,
    reasons: [
      { label: "能力補強", value: 88, note: "提供政策分析需要的經濟基礎" },
      { label: "興趣相符", value: 72, note: "與主要興趣屬間接連結" },
      { label: "時間適配", value: 76, note: "週二上午與移動安排較緊" },
      { label: "語言挑戰", value: 74, note: "英文授課符合你接受的難度" },
    ], source: "附件資料",
  },
  {
    id: "nccu-stats", school: "NCCU", code: "STAT 201", title: "統計學", titleEn: "Statistics",
    unit: "統計學系", credits: 3, level: "大學部", language: "中文", time: "一 09:10–12:00",
    teacher: "示範教師", tags: ["統計", "資料科學", "量化方法"],
    summary: "涵蓋機率、估計、檢定與迴歸，建立後續資料分析及研究方法的核心能力。",
    fit: 80,
    reasons: [
      { label: "路徑重要性", value: 95, note: "是資料科學方向的重要基礎" },
      { label: "興趣相符", value: 85, note: "符合量化分析偏好" },
      { label: "時間適配", value: 71, note: "週一上午與清大課程移動成本偏高" },
      { label: "跨校新穎性", value: 69, note: "兩校皆有相近基礎課，可優先比較時段" },
    ], source: "政大原型示範",
  },
];

const connections = [
  ["nthu-cs1001", "nccu-ds205", 88, "能力路徑：程式設計到資料應用"],
  ["nthu-cs1001", "nccu-lawtech", 73, "應用開發與科技治理"],
  ["nthu-aes4701", "nccu-sust301", 93, "共同主題：永續治理"],
  ["nthu-aes4701", "nthu-chem1000", 76, "能力路徑：化學基礎"],
  ["nthu-aes4701", "nthu-bmes1111", 82, "共同領域：環境科學"],
  ["nccu-sust301", "nccu-ds205", 78, "政策資料分析"],
  ["nccu-ds205", "nccu-lawtech", 85, "AI 治理與社會影響"],
  ["nccu-ds205", "nccu-stats", 91, "能力路徑：統計基礎"],
  ["nccu-sust301", "nthu-econ101", 72, "政策與經濟分析"],
  ["nthu-bmes1111", "nthu-chem1000", 74, "自然科學基礎"],
] as const;

const schoolLabel: Record<School, string> = { NTHU: "清大", NCCU: "政大" };

function SchoolBadge({ school }: { school: School }) {
  return <span className={`school-badge ${school === "NTHU" ? "school-nthu" : "school-nccu"}`}>{schoolLabel[school]}</span>;
}

export default function Home() {
  const [view, setView] = useState<"discover" | "map">("discover");
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState<"ALL" | School>("ALL");
  const [level, setLevel] = useState<"ALL" | Course["level"]>("ALL");
  const [language, setLanguage] = useState<"ALL" | Course["language"]>("ALL");
  const [selected, setSelected] = useState<Course>(courses[0]);
  const [compare, setCompare] = useState<Course[]>([courses[0], courses[1]]);
  const [saved, setSaved] = useState<string[]>(["nccu-ds205"]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("course-compass-theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("course-compass-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((course) => {
      const literal = [course.title, course.titleEn, course.code, course.unit, ...course.tags].join(" ").toLowerCase();
      const semantic = (course.semanticTerms ?? []).join(" ").toLowerCase();
      const matchesQuery = !q || literal.includes(q) || semantic.includes(q);
      return matchesQuery && (school === "ALL" || course.school === school) && (level === "ALL" || course.level === level) && (language === "ALL" || course.language === language);
    });
  }, [query, school, level, language]);

  const toggleCompare = (course: Course) => {
    setCompare((current) => current.some((item) => item.id === course.id) ? current.filter((item) => item.id !== course.id) : [...current.slice(-1), course]);
  };
  const resetFilters = () => { setSchool("ALL"); setLevel("ALL"); setLanguage("ALL"); setQuery(""); };

  return (
    <main className="app-shell min-h-screen">
      <header className="site-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3" onClick={() => setView("discover")}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#17211f] text-white shadow-sm"><Network size={19} /></span>
            <span className="text-left"><span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6d7773]">Course compass</span><span className="block text-[17px] font-bold tracking-tight">課徑</span></span>
          </button>
          <nav className="ml-auto hidden items-center gap-1 rounded-full border border-black/8 bg-white/65 p-1 sm:flex">
            <button className={`nav-pill ${view === "discover" ? "nav-pill-active" : ""}`} onClick={() => setView("discover")}><Compass size={15} /> 探索</button>
            <button className={`nav-pill ${view === "map" ? "nav-pill-active" : ""}`} onClick={() => setView("map")}><Map size={15} /> 推薦地圖</button>
          </nav>
          <button aria-label={theme === "light" ? "切換暗夜主題" : "切換亮色主題"} className="theme-toggle" onClick={toggleTheme}>
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}<span className="hidden lg:inline">{theme === "light" ? "暗夜" : "亮色"}</span>
          </button>
          <button className="relative ml-1 flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5" onClick={() => setCompareOpen(true)}>
            <GitCompareArrows size={17} /><span className="hidden md:inline">比較</span><span className="rounded-full bg-[#17211f] px-1.5 py-0.5 text-[10px] text-white">{compare.length}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 pb-24 sm:px-6 lg:px-8">
        <section className="hero-grid relative overflow-hidden rounded-b-[36px] bg-[#17211f] px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-5 flex items-center gap-2 text-xs font-medium text-white/60"><span className="rounded-full border border-white/18 px-3 py-1">互動原型</span><span>清大 × 政大</span><span className="h-1 w-1 rounded-full bg-[#ff8d6b]" /><span>示範資料</span></div>
            <h1 className="max-w-2xl text-balance text-3xl font-bold leading-[1.15] tracking-[-0.035em] sm:text-5xl">找到下一門課，也看懂它為什麼適合你。</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">跨校搜尋、比較相似課，沿著你的興趣與能力路徑建立個人化推薦地圖。</p>
            <div className="hero-search mt-7 flex max-w-3xl items-center gap-2 rounded-2xl p-2 shadow-[0_24px_60px_rgba(0,0,0,.22)]">
              <Search className="ml-2 shrink-0 text-[#6d7773]" size={20} />
              <input aria-label="搜尋課程" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none sm:text-base" placeholder="試試 APP、永續、資料治理…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="semantic-search-button rounded-xl px-4 py-2.5 text-sm font-bold" onClick={() => setView("discover")}>語意搜尋</button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-white/55"><Sparkles size={13} />不必輸入完整課名，例如 APP 也能找到「程式設計一」。</p>
          </div>
          <div className="hero-orbit hidden lg:block" aria-hidden="true"><span className="orbit-ring orbit-one" /><span className="orbit-ring orbit-two" /><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /><span className="orbit-center"><Sparkles size={24} /></span></div>
        </section>

        <div className="mt-5 flex sm:hidden"><button className={`mobile-tab ${view === "discover" ? "mobile-tab-active" : ""}`} onClick={() => setView("discover")}><Compass size={16} />探索</button><button className={`mobile-tab ${view === "map" ? "mobile-tab-active" : ""}`} onClick={() => setView("map")}><Map size={16} />推薦地圖</button></div>

        {view === "discover" ? (
          <section className="mt-7 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
            <aside className={`${filtersOpen ? "block" : "hidden"} xl:block`}>
              <div className="sticky top-24 rounded-3xl border border-black/8 bg-white/80 p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={17} />篩選條件</h2><button className="text-xs font-semibold text-[#d65f43]" onClick={resetFilters}>清除</button></div>
                <FilterGroup label="學校"><FilterButton active={school === "ALL"} onClick={() => setSchool("ALL")}>全部</FilterButton><FilterButton active={school === "NTHU"} onClick={() => setSchool("NTHU")}>清大</FilterButton><FilterButton active={school === "NCCU"} onClick={() => setSchool("NCCU")}>政大</FilterButton></FilterGroup>
                <FilterGroup label="課程層級"><FilterButton active={level === "ALL"} onClick={() => setLevel("ALL")}>全部</FilterButton><FilterButton active={level === "大學部"} onClick={() => setLevel("大學部")}>大學部</FilterButton><FilterButton active={level === "研究所"} onClick={() => setLevel("研究所")}>研究所</FilterButton></FilterGroup>
                <FilterGroup label="授課語言"><FilterButton active={language === "ALL"} onClick={() => setLanguage("ALL")}>全部</FilterButton><FilterButton active={language === "中文"} onClick={() => setLanguage("中文")}>中文</FilterButton><FilterButton active={language === "英文"} onClick={() => setLanguage("英文")}>英文</FilterButton></FilterGroup>
                <div className="mt-6 rounded-2xl bg-[#eff4ef] p-4"><div className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} className="text-[#e46f50]" />你的推薦偏好</div><div className="mt-3 flex flex-wrap gap-1.5">{["永續", "資料科學", "公共議題", "跨領域"].map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#4d5b57]">{item}</span>)}</div><button className="mt-3 flex items-center gap-1 text-xs font-bold text-[#315c4d]">調整偏好 <ArrowRight size={12} /></button></div>
              </div>
            </aside>

            <div>
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#89918e]">Personalized discovery</p><h2 className="mt-1 text-2xl font-bold tracking-tight">為你挑選的課程</h2></div><button className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold xl:hidden" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={15} /> 篩選</button></div>
              <div className="mb-4 flex flex-wrap gap-2"><span className="filter-summary"><University size={13} />{school === "ALL" ? "兩校" : schoolLabel[school]}</span><span className="filter-summary"><GraduationCap size={13} />{level === "ALL" ? "所有層級" : level}</span><span className="filter-summary"><Languages size={13} />{language === "ALL" ? "所有語言" : language}</span><span className="ml-auto self-center text-xs text-[#6d7773]">找到 {filtered.length} 門</span></div>
              {query.trim() && filtered.some((course) => !(course.title + course.titleEn + course.code + course.unit + course.tags.join("")).toLowerCase().includes(query.trim().toLowerCase())) && <div className="semantic-hint mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs leading-5"><Sparkles size={15} className="mt-0.5 shrink-0" /><span><strong>語意延伸：</strong>「{query.trim()}」可能代表應用開發需求，因此也推薦沒有相同字面的基礎課程。</span></div>}
              <div className="grid gap-4 lg:grid-cols-2">
                {filtered.map((course) => (
                  <article key={course.id} className={`course-card group ${selected.id === course.id ? "course-card-selected" : ""}`} onClick={() => setSelected(course)}>
                    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><SchoolBadge school={course.school} /><span className="text-[11px] font-bold tracking-wide text-[#7d8783]">{course.code}</span></div><button aria-label="收藏課程" className={`icon-button ${saved.includes(course.id) ? "icon-button-saved" : ""}`} onClick={(event) => { event.stopPropagation(); setSaved((items) => items.includes(course.id) ? items.filter((id) => id !== course.id) : [...items, course.id]); }}><Heart size={16} fill={saved.includes(course.id) ? "currentColor" : "none"} /></button></div>
                    <h3 className="mt-4 text-lg font-bold tracking-tight">{course.title}</h3><p className="mt-1 line-clamp-1 text-xs text-[#77817d]">{course.titleEn}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#53605c]">{course.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">{course.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>
                    <div className="mt-5 flex items-end justify-between border-t border-black/7 pt-4"><div className="space-y-1 text-[11px] text-[#65706c]"><p className="flex items-center gap-1.5"><Clock3 size={12} />{course.time}</p><p className="flex items-center gap-1.5"><BookOpen size={12} />{course.credits} 學分・{course.unit}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8a938f]">適合度</p><p className="text-2xl font-black tracking-tight text-[#e46f50]">{course.fit}<span className="text-xs">%</span></p></div></div>
                  </article>
                ))}
              </div>
              {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-black/15 bg-white/50 px-6 py-16 text-center"><Search className="mx-auto text-[#9aa29f]" /><h3 className="mt-3 font-bold">沒有符合條件的課程</h3><p className="mt-1 text-sm text-[#75807c]">試著清除部分篩選條件或換一個關鍵字。</p><button className="mt-4 text-sm font-bold text-[#d65f43]" onClick={resetFilters}>清除全部</button></div>}
            </div>
            <aside className="hidden xl:block"><CourseDetail course={selected} compare={compare} toggleCompare={toggleCompare} setView={setView} /></aside>
          </section>
        ) : <RecommendationMap selected={selected} setSelected={setSelected} compare={compare} toggleCompare={toggleCompare} setCompareOpen={setCompareOpen} />}
      </div>

      <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-black/8 bg-white/95 px-4 py-3 shadow-[0_16px_50px_rgba(23,33,31,.16)] backdrop-blur xl:hidden"><div className="min-w-0"><p className="truncate text-xs font-bold">{selected.title}</p><p className="text-[10px] text-[#77817d]">適合度 {selected.fit}%</p></div><button className="rounded-lg bg-[#17211f] px-3 py-2 text-xs font-bold text-white" onClick={() => setCompareOpen(true)}>詳情</button></div>
      {compareOpen && <CompareModal courses={compare.length ? compare : [selected]} close={() => setCompareOpen(false)} remove={(course) => setCompare((items) => items.filter((item) => item.id !== course.id))} />}
    </main>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="mb-5"><p className="mb-2 text-xs font-bold text-[#64706c]">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`filter-button ${active ? "filter-button-active" : ""}`} onClick={onClick}>{active && <Check size={11} />}{children}</button>; }

function CourseDetail({ course, compare, toggleCompare, setView }: { course: Course; compare: Course[]; toggleCompare: (course: Course) => void; setView: (view: "discover" | "map") => void }) {
  const inCompare = compare.some((item) => item.id === course.id);
  return (
    <div className="sticky top-24 overflow-hidden rounded-3xl border border-black/8 bg-[#17211f] text-white shadow-xl shadow-[#17211f]/10">
      <div className="p-6"><div className="flex items-center justify-between"><SchoolBadge school={course.school} /><span className="text-xs font-bold text-white/45">{course.code}</span></div><h2 className="mt-5 text-2xl font-bold leading-tight tracking-tight">{course.title}</h2><p className="mt-2 text-xs leading-5 text-white/45">{course.titleEn}</p><p className="mt-4 text-sm leading-6 text-white/70">{course.summary}</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-xs"><DetailStat icon={<BookOpen size={14} />} label={`${course.credits} 學分`} /><DetailStat icon={<Languages size={14} />} label={course.language} /><DetailStat icon={<Clock3 size={14} />} label={course.time.split("・")[0]} /><DetailStat icon={<GraduationCap size={14} />} label={course.level} /></div>
        <div className="mt-6 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/40">Personal fit</p><p className="mt-1 text-4xl font-black text-[#ff8d6b]">{course.fit}<span className="text-sm">%</span></p></div><button className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold transition hover:bg-white/10" onClick={() => toggleCompare(course)}>{inCompare ? "移出比較" : "加入比較"}</button></div>
      </div>
      <div className="bg-white p-6 text-[#17211f]"><div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles size={15} className="text-[#e46f50]" />推薦原因</h3><button title="分數為原型示範" className="text-[#8c9592]"><CircleHelp size={15} /></button></div><div className="space-y-4">{course.reasons.map((reason) => <div key={reason.label}><div className="flex items-center justify-between text-[11px]"><span className="font-bold">{reason.label}</span><span>{reason.value}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e9ece9]"><div className="h-full rounded-full bg-[#5e8b77]" style={{ width: `${reason.value}%` }} /></div><p className="mt-1 text-[10px] leading-4 text-[#78817e]">{reason.note}</p></div>)}</div><button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#eff4ef] py-3 text-xs font-bold text-[#315c4d]" onClick={() => setView("map")}><Network size={15} />在推薦地圖中查看</button></div>
    </div>
  );
}
function DetailStat({ icon, label }: { icon: React.ReactNode; label: string }) { return <div className="flex items-center gap-2 rounded-xl bg-white/7 px-3 py-2.5 text-white/70">{icon}<span className="truncate">{label}</span></div>; }

function RecommendationMap({ selected, setSelected, compare, toggleCompare, setCompareOpen }: { selected: Course; setSelected: (course: Course) => void; compare: Course[]; toggleCompare: (course: Course) => void; setCompareOpen: (open: boolean) => void }) {
  type SavedMap = { id: string; name: string; payload: string; createdAt: string; updatedAt: string };
  const [mapName, setMapName] = useState("我的跨校學習地圖");
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState("");
  const positions: Record<string, [number, number]> = { "nthu-cs1001": [17, 43], "nthu-aes4701": [48, 38], "nccu-sust301": [69, 25], "nthu-chem1000": [29, 20], "nccu-ds205": [75, 51], "nthu-bmes1111": [29, 59], "nccu-lawtech": [84, 73], "nthu-econ101": [47, 80], "nccu-stats": [62, 69] };

  const loadMaps = async () => {
    try {
      const response = await fetch("/api/maps");
      if (!response.ok) throw new Error();
      const data = await response.json() as { maps: SavedMap[] };
      setSavedMaps(data.maps);
    } catch { setMapStatus("登入後即可同步地圖紀錄"); }
  };
  useEffect(() => { void loadMaps(); }, []);

  const saveMap = async () => {
    setMapStatus("儲存中…");
    const response = await fetch("/api/maps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: mapName, payload: { selectedId: selected.id, compareIds: compare.map((item) => item.id), courseIds: courses.map((course) => course.id) } }) });
    setMapStatus(response.ok ? "已儲存到你的帳號" : "儲存失敗，請確認已登入");
    if (response.ok) { await loadMaps(); setHistoryOpen(true); }
  };
  const renameMap = async (map: SavedMap) => {
    const name = window.prompt("重新命名地圖", map.name)?.trim();
    if (!name) return;
    const response = await fetch(`/api/maps/${map.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (response.ok) await loadMaps();
  };
  const deleteMap = async (map: SavedMap) => {
    if (!window.confirm(`確定刪除「${map.name}」？此動作無法復原。`)) return;
    const response = await fetch(`/api/maps/${map.id}`, { method: "DELETE" });
    if (response.ok) await loadMaps();
  };
  const openMap = (map: SavedMap) => {
    try {
      const payload = JSON.parse(map.payload) as { selectedId?: string };
      const course = courses.find((item) => item.id === payload.selectedId);
      if (course) setSelected(course);
      setMapName(map.name);
      setMapStatus(`已載入「${map.name}」`);
    } catch { setMapStatus("這筆地圖紀錄無法讀取"); }
  };
  return (
    <section className="mt-7">
      <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#89918e]">Recommendation graph</p><h2 className="mt-1 text-3xl font-bold tracking-tight">你的推薦地圖</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66716d]">線條代表課程之間的主題、能力或跨域關聯。點選節點可查看建立原因與下一步推薦。</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="legend-pill"><span className="h-2 w-2 rounded-full bg-[#28004D]" />清大</span><span className="legend-pill"><span className="h-2 w-2 rounded-full bg-[#000079]" />政大</span><span className="legend-pill"><span className="h-[2px] w-4 bg-[#a8b0ac]" />推薦連結</span></div></div>
      <div className="map-savebar mb-5 rounded-2xl border p-3 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="flex min-w-0 flex-1 items-center gap-2"><Save size={16} /><input aria-label="地圖名稱" className="map-name-input min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none" value={mapName} onChange={(event) => setMapName(event.target.value)} maxLength={80} /></div><button className="save-map-button rounded-xl px-4 py-2.5 text-xs font-bold" onClick={saveMap}>儲存目前地圖</button><button className="history-button flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" onClick={() => setHistoryOpen((open) => !open)}><History size={15} />我的地圖 <span>{savedMaps.length}</span></button></div>{mapStatus && <p className="mt-2 text-[11px] text-muted-foreground">{mapStatus}</p>}
        {historyOpen && <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-2 xl:grid-cols-3">{savedMaps.length ? savedMaps.map((map) => <div key={map.id} className="saved-map-row flex items-center gap-2 rounded-xl border p-3"><button className="min-w-0 flex-1 text-left" onClick={() => openMap(map)}><span className="block truncate text-xs font-bold">{map.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{new Date(map.updatedAt).toLocaleString("zh-TW")}</span></button><button aria-label="重新命名" className="mini-action" onClick={() => renameMap(map)}><Pencil size={13} /></button><button aria-label="刪除地圖" className="mini-action danger" onClick={() => deleteMap(map)}><Trash2 size={13} /></button></div>) : <p className="py-3 text-xs text-muted-foreground">尚無紀錄，替目前地圖命名後儲存。</p>}</div>}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="map-canvas relative min-h-[620px] overflow-hidden rounded-[32px] border border-black/8 bg-[#ecf0ea]"><div className="map-grid absolute inset-0" /><svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{connections.map(([from, to, score]) => { const [x1, y1] = positions[from]; const [x2, y2] = positions[to]; const active = from === selected.id || to === selected.id; return <line key={`${from}-${to}`} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" stroke={active ? "#17211f" : "#b9c2bd"} strokeWidth={active ? 2.2 : 1.2} strokeDasharray={score < 80 ? "5 5" : undefined} opacity={active ? .75 : .6} />; })}</svg>
          {courses.map((course) => { const [x, y] = positions[course.id]; const active = course.id === selected.id; return <button key={course.id} className={`map-node ${course.school === "NTHU" ? "map-node-nthu" : "map-node-nccu"} ${active ? "map-node-active" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={() => setSelected(course)}><span className="map-node-score">{course.fit}%</span><span className="map-node-title">{course.title}</span><span className="map-node-code">{schoolLabel[course.school]}・{course.code}</span></button>; })}
          <div className="absolute bottom-5 left-5 rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-[11px] text-[#64706c] shadow-sm backdrop-blur"><p className="font-bold text-[#283532]">地圖如何建立？</p><p className="mt-1">課程內容 40%・學習路徑 25%・個人偏好 20%・時段與限制 15%</p></div>
        </div>
        <aside className="rounded-[32px] border border-black/8 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><SchoolBadge school={selected.school} /><span className="text-xs font-bold text-[#8a938f]">{selected.code}</span></div><h3 className="mt-4 text-2xl font-bold tracking-tight">{selected.title}</h3><p className="mt-2 text-xs text-[#7c8582]">{selected.unit}</p><p className="mt-4 text-sm leading-6 text-[#56635f]">{selected.summary}</p><div className="my-6 h-px bg-black/8" /><h4 className="flex items-center gap-2 text-sm font-bold"><Network size={16} />關聯建立原因</h4>
          <div className="mt-4 space-y-3">{connections.filter(([from, to]) => from === selected.id || to === selected.id).map(([from, to, score, reason]) => { const other = courses.find((course) => course.id === (from === selected.id ? to : from))!; return <button key={`${from}-${to}`} className="relation-row" onClick={() => setSelected(other)}><span className={`relation-dot ${other.school === "NTHU" ? "bg-[#4d8871]" : "bg-[#db6b4e]"}`} /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-bold">{other.title}</span><span className="mt-0.5 block truncate text-[10px] text-[#7b8581]">{reason}</span></span><span className="text-xs font-black text-[#e46f50]">{score}</span></button>; })}</div>
          <div className="mt-6 rounded-2xl bg-[#f3f5f1] p-4"><p className="flex items-center gap-2 text-xs font-bold"><Info size={14} />推薦分數的用途</p><p className="mt-2 text-[11px] leading-5 text-[#6d7773]">相似代表內容或學習路徑接近，不代表兩校正式認定可抵免。正式等價需由校方或人工審核。</p></div><div className="mt-5 grid grid-cols-2 gap-2"><button className={`rounded-xl border px-3 py-3 text-xs font-bold ${compare.some((item) => item.id === selected.id) ? "border-[#17211f] bg-[#17211f] text-white" : "border-black/10"}`} onClick={() => toggleCompare(selected)}>{compare.some((item) => item.id === selected.id) ? "已加入比較" : "加入比較"}</button><button className="rounded-xl bg-[#ff8d6b] px-3 py-3 text-xs font-bold" onClick={() => setCompareOpen(true)}>開啟比較</button></div>
        </aside>
      </div>
    </section>
  );
}

function CompareModal({ courses, close, remove }: { courses: Course[]; close: () => void; remove: (course: Course) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#17211f]/55 p-4 backdrop-blur-sm" onMouseDown={close}><div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[30px] bg-[#f8f7f3] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/8 bg-[#f8f7f3]/95 px-6 py-5 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#89918e]">Course comparison</p><h2 className="mt-1 text-xl font-bold">跨校相似課比較</h2></div><button className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white" onClick={close}><X size={17} /></button></div>
    {courses.length < 2 ? <div className="px-6 py-16 text-center"><GitCompareArrows className="mx-auto text-[#9aa29f]" /><h3 className="mt-3 font-bold">再加入一門課即可比較</h3><p className="mt-1 text-sm text-[#74807b]">從搜尋結果或推薦地圖選擇另一門課。</p></div> : <div className="p-5 sm:p-7"><div className="grid grid-cols-[120px_repeat(2,minmax(0,1fr))] gap-x-4 gap-y-0 text-sm max-sm:grid-cols-[88px_repeat(2,minmax(0,1fr))]"><div />{courses.slice(0, 2).map((course) => <div key={course.id} className="relative rounded-2xl bg-white p-4 shadow-sm"><button className="absolute right-3 top-3 text-[#98a09d]" onClick={() => remove(course)}><X size={14} /></button><SchoolBadge school={course.school} /><h3 className="mt-3 font-bold leading-5">{course.title}</h3><p className="mt-1 text-[10px] text-[#7c8582]">{course.code}</p><p className="mt-4 text-3xl font-black text-[#e46f50]">{course.fit}<span className="text-xs">%</span></p></div>)}<CompareRow label="學分" values={courses.slice(0, 2).map((course) => `${course.credits} 學分`)} /><CompareRow label="系所" values={courses.slice(0, 2).map((course) => course.unit)} /><CompareRow label="時間" values={courses.slice(0, 2).map((course) => course.time)} /><CompareRow label="語言" values={courses.slice(0, 2).map((course) => course.language)} /><CompareRow label="核心主題" values={courses.slice(0, 2).map((course) => course.tags.join("、"))} /><CompareRow label="定位" values={courses.slice(0, 2).map((course) => course.summary)} tall /></div><div className="mt-6 rounded-2xl border border-[#e6c7bc] bg-[#fff2ed] p-5"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-[#d65f43]" />比較結論</p><p className="mt-2 text-sm leading-6 text-[#685651]">{courses[0].school !== courses[1].school ? `兩門課共有「${courses[0].tags.filter((tag) => courses[1].tags.includes(tag)).join("、") || "跨域學習"}」連結。${courses[0].title}偏向${courses[0].unit}觀點，${courses[1].title}則補充${courses[1].unit}視角，適合並列考慮。` : "兩門課來自同一學校，可優先依時段、先修要求與學習路徑選擇。"}</p><p className="mt-2 text-[11px] text-[#91746a]">這是推薦相似性，不等同正式學分抵免認定。</p></div></div>}</div></div>;
}
function CompareRow({ label, values, tall = false }: { label: string; values: string[]; tall?: boolean }) { return <><div className={`border-b border-black/7 py-4 text-xs font-bold text-[#6c7672] ${tall ? "leading-6" : ""}`}>{label}</div>{values.map((value, index) => <div key={`${label}-${index}`} className={`border-b border-black/7 py-4 text-xs leading-5 text-[#46534f] ${tall ? "min-h-28" : ""}`}>{value}</div>)}</>; }
