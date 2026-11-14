"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  GitCompareArrows,
  GraduationCap,
  Heart,
  History,
  AlertTriangle,
  FileText,
  ExternalLink,
  Languages,
  LoaderCircle,
  LogIn,
  LogOut,
  Map,
  Network,
  ScanLine,
  Search,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Pencil,
  University,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type School = "NTHU" | "NCCU";
type Account = { id: string; email: string; displayName: string };
type TranscriptCandidate = { code: string; title: string; credits: number | null; department: string; confidence: number };
type TranscriptRow = { id: string; term: string; courseCode: string; courseName: string; credits: number | null; gradeRaw: string; confidence: number; candidates?: TranscriptCandidate[] };
type TranscriptHistory = { id: string; fileName: string; fileType: string; createdAt: string; confirmedAt: string | null; rows: TranscriptRow[] };
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
  source: "附件資料" | "清大官方開放課程資料" | "政大課程資料" | "原型語意示範";
};

const featuredMapCourses: Course[] = [
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
    id: "nccu-zu1850001", school: "NCCU", code: "ZU1850001", title: "量化的環境治理：永續指標的實作與政治",
    titleEn: "Governing Environment by Numbers", unit: "創新國際學院", credits: 3,
    level: "大學部", language: "英文", time: "時間請見政大課程大綱", teacher: "江順楠",
    tags: ["環境與永續", "政策、法律與治理"],
    summary: "從永續報告、碳盤查與指標政治理解環境治理，並以高等教育永續報告進行實作分析。",
    fit: 91,
    reasons: [
      { label: "興趣相符", value: 95, note: "與永續及社會影響偏好高度吻合" },
      { label: "能力銜接", value: 86, note: "適合已有社會科學基礎的學生" },
      { label: "時間適配", value: 90, note: "週二下午仍有可用時段" },
      { label: "跨校新穎性", value: 94, note: "補足清大工程課較少涵蓋的政策觀點" },
    ], source: "政大課程資料",
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
    id: "nccu-000358011", school: "NCCU", code: "000358011", title: "資料分析與程式設計入門",
    titleEn: "Introduction to Data Analysis and Programming", unit: "資訊管理學系", credits: 3, level: "大學部", language: "中文",
    time: "時間請見政大課程大綱", teacher: "李曉惠等歷年授課教師", tags: ["資料與 AI", "程式與軟體"],
    summary: "政大正式課程資料中的資料分析與程式設計入門課程，實際開課教師與時段請以當期課程大綱為準。",
    fit: 89,
    reasons: [
      { label: "興趣相符", value: 92, note: "同時命中資料與社會影響兩項偏好" },
      { label: "能力銜接", value: 88, note: "可延伸你已收藏的統計入門" },
      { label: "時間適配", value: 85, note: "與週三上午課程無衝突" },
      { label: "跨域價值", value: 93, note: "連結技術實作與治理議題" },
    ], source: "政大課程資料",
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
    id: "nccu-zu1841001", school: "NCCU", code: "ZU1841001", title: "科技法律與資料治理",
    titleEn: "Technology Law and Data Governance", unit: "創新國際學院", credits: 3, level: "大學部", language: "英文",
    time: "時間請見政大課程大綱", teacher: "彭睿仁", tags: ["政策、法律與治理", "資料與 AI"],
    summary: "討論個資保護、人工智慧治理、平台責任、跨境資料流通與歐盟資料治理制度。",
    fit: 82,
    reasons: [
      { label: "跨域價值", value: 96, note: "補足技術課程之外的法律視角" },
      { label: "興趣相符", value: 84, note: "符合 AI 社會影響偏好" },
      { label: "時間適配", value: 80, note: "週五上午可排入，但通勤緩衝較短" },
      { label: "能力銜接", value: 70, note: "需適應法律案例閱讀" },
    ], source: "政大課程資料",
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
    id: "nccu-000359011", school: "NCCU", code: "000359011", title: "統計學（一）", titleEn: "Statistics (I)",
    unit: "統計學系", credits: 3, level: "大學部", language: "中文", time: "時間請見政大課程大綱",
    teacher: "吳漢銘等歷年授課教師", tags: ["資料與 AI", "統計", "量化方法"],
    summary: "介紹敘述統計、機率分配、抽樣分配、估計與假設檢定，並搭配 R 軟體進行計算與解讀。",
    fit: 80,
    reasons: [
      { label: "路徑重要性", value: 95, note: "是資料科學方向的重要基礎" },
      { label: "興趣相符", value: 85, note: "符合量化分析偏好" },
      { label: "時間適配", value: 71, note: "週一上午與清大課程移動成本偏高" },
      { label: "跨校新穎性", value: 69, note: "兩校皆有相近基礎課，可優先比較時段" },
    ], source: "政大課程資料",
  },
  {
    id: "nthu-cs1356", school: "NTHU", code: "CS 1356", title: "程式設計二", titleEn: "Introduction to Programming (II)", unit: "資訊工程學系", credits: 3, level: "大學部", language: "中文", time: "二 Ta–Tc", teacher: "陳煥宗", tags: ["程式設計", "軟體開發", "運算思維"], summary: "延伸基礎程式設計，進入物件、模組與較完整的程式實作。", fit: 88, reasons: [{ label: "能力銜接", value: 95, note: "直接延續程式設計一" }, { label: "實作深度", value: 90, note: "增加較完整的程式專題" }, { label: "路徑重要性", value: 92, note: "銜接資料結構與軟體課程" }, { label: "時間適配", value: 76, note: "需確認晚間節次" }], source: "附件資料",
  },
  {
    id: "nthu-cs2351", school: "NTHU", code: "CS 2351", title: "資料結構", titleEn: "Data Structures", unit: "資訊工程學系", credits: 3, level: "大學部", language: "中文", time: "二 10:10–12:00・四 10:10–11:00", teacher: "沈志亞", tags: ["程式設計", "資料結構", "演算法"], summary: "學習串列、樹、圖與雜湊等資料結構，建立演算法與軟體效能基礎。", fit: 90, reasons: [{ label: "能力銜接", value: 94, note: "承接程式設計基礎" }, { label: "路徑重要性", value: 97, note: "是演算法與系統課核心先備" }, { label: "實作深度", value: 91, note: "強調資料結構實作" }, { label: "時間適配", value: 82, note: "需確認週二、週四時段" }], source: "附件資料",
  },
  {
    id: "nthu-cs4602", school: "NTHU", code: "CS 4602", title: "機器學習導論", titleEn: "Introduction to Machine Learning", unit: "資訊工程學系", credits: 3, level: "大學部", language: "中文", time: "二 10:10–12:00・四 10:10–11:00", teacher: "郭博智", tags: ["AI", "資料科學", "程式設計"], summary: "介紹監督式與非監督式學習，連結程式實作、資料分析與模型評估。", fit: 91, reasons: [{ label: "興趣相符", value: 96, note: "符合 AI 與資料科學偏好" }, { label: "能力銜接", value: 88, note: "需要程式與統計基礎" }, { label: "實作價值", value: 93, note: "可建立模型實作能力" }, { label: "時間適配", value: 82, note: "需確認週二、週四時段" }], source: "附件資料",
  },
  {
    id: "nthu-aes4702", school: "NTHU", code: "AES 4702", title: "永續環境治理設計思考", titleEn: "Design Thinking for Sustainable Environmental Governance", unit: "分析與環境科學研究所", credits: 3, level: "大學部", language: "中文", time: "四 13:20–16:10", teacher: "陳俊明、周秀娟", tags: ["永續", "環境治理", "設計思考"], summary: "以設計思考處理永續治理問題，從利害關係人需求走向政策與方案原型。", fit: 93, reasons: [{ label: "興趣相符", value: 96, note: "直接連結永續與環境治理" }, { label: "跨域價值", value: 95, note: "融合政策與設計方法" }, { label: "實作深度", value: 89, note: "重視問題定義與方案原型" }, { label: "時間適配", value: 90, note: "週四下午完整時段" }], source: "附件資料",
  },
  {
    id: "nthu-aes5203", school: "NTHU", code: "AES 5203", title: "環境化學", titleEn: "Environment Chemistry", unit: "分析與環境科學研究所", credits: 3, level: "研究所", language: "中文", time: "一 10:10–12:00・五 10:10–12:00", teacher: "董瑞安", tags: ["環境", "化學", "污染分析"], summary: "從化學反應與分析方法理解污染物在環境中的轉化、傳輸與風險。", fit: 87, reasons: [{ label: "領域相符", value: 95, note: "連結環境科學與化學" }, { label: "能力銜接", value: 90, note: "適合已有普通化學基礎" }, { label: "研究價值", value: 92, note: "可銜接污染分析研究" }, { label: "難度適配", value: 78, note: "研究所課程需評估先備" }], source: "附件資料",
  },
  {
    id: "nthu-econ3040", school: "NTHU", code: "ECON 3040", title: "經濟資料分析與預測", titleEn: "Economic Data Analysis and Predictions", unit: "經濟學系", credits: 3, level: "大學部", language: "中文", time: "一 13:20–15:10", teacher: "游朝恩", tags: ["經濟", "資料科學", "量化方法"], summary: "以經濟資料進行整理、建模與預測，連結經濟判斷與實證分析。", fit: 86, reasons: [{ label: "能力銜接", value: 91, note: "結合經濟與資料分析" }, { label: "實作價值", value: 92, note: "強調資料與預測" }, { label: "跨域價值", value: 88, note: "可銜接政策分析" }, { label: "時間適配", value: 82, note: "週一下午時段" }], source: "附件資料",
  },
  {
    id: "nthu-stat2622", school: "NTHU", code: "STAT 2622", title: "統計資料分析", titleEn: "Statistical Data Analysis", unit: "統計學研究所", credits: 3, level: "大學部", language: "中文", time: "二 13:20–14:10・四 13:20–15:10", teacher: "孫政宇", tags: ["統計", "資料科學", "量化方法"], summary: "從描述統計、推論到模型診斷，建立以真實資料回答問題的完整流程。", fit: 89, reasons: [{ label: "能力銜接", value: 94, note: "延伸統計學基礎" }, { label: "實作價值", value: 93, note: "聚焦真實資料分析" }, { label: "路徑重要性", value: 91, note: "支援資料科學與研究方法" }, { label: "時間適配", value: 84, note: "分散於週二、週四" }], source: "附件資料",
  },
  {
    id: "nthu-lst3501", school: "NTHU", code: "LST 3501", title: "科技與法律", titleEn: "Law and Technology", unit: "科技法律研究所", credits: 2, level: "大學部", language: "中文", time: "四 10:10–12:00", teacher: "林勤富", tags: ["科技法律", "AI", "倫理"], summary: "從法律與制度觀點分析科技創新、資料使用與人工智慧帶來的責任問題。", fit: 85, reasons: [{ label: "跨域價值", value: 96, note: "連結科技與法律" }, { label: "興趣相符", value: 88, note: "符合 AI 社會影響偏好" }, { label: "閱讀挑戰", value: 78, note: "需要案例與法規閱讀" }, { label: "時間適配", value: 88, note: "週四上午時段" }], source: "附件資料",
  },
  {
    id: "nthu-cs5605", school: "NTHU", code: "CS 5605", title: "AI 倫理、法律與社會", titleEn: "AI Ethics, Law and Society", unit: "資訊工程學系", credits: 2, level: "研究所", language: "中文", time: "五 10:10–12:00", teacher: "跨域師資", tags: ["AI", "科技法律", "倫理", "社會影響"], summary: "從工程、法律與社會觀點討論人工智慧的公平、責任、治理與風險。", fit: 90, reasons: [{ label: "興趣相符", value: 96, note: "直接命中 AI 社會影響" }, { label: "跨域價值", value: 97, note: "整合工程、法律與倫理" }, { label: "研究價值", value: 88, note: "適合進階議題探索" }, { label: "難度適配", value: 80, note: "研究所課程需評估背景" }], source: "附件資料",
  },
  {
    id: "nthu-klst6206", school: "NTHU", code: "KLST 6206", title: "APP 設計與教育應用", titleEn: "APP Design and Educational Applications", unit: "學習科學與科技研究所", credits: 3, level: "研究所", language: "中文", time: "五 09:00–12:00", teacher: "唐文華", tags: ["APP", "程式設計", "互動設計"], semanticTerms: ["app", "mobile", "application", "行動應用", "應用程式"], summary: "以 APP 原型與互動設計回應教育情境需求，適合已有程式基礎的學生。", fit: 90, reasons: [{ label: "語意意圖", value: 99, note: "直接對應 APP 設計需求" }, { label: "能力銜接", value: 88, note: "建議先具備程式設計基礎" }, { label: "實作價值", value: 95, note: "產出可操作的應用原型" }, { label: "難度適配", value: 80, note: "研究所課程需評估背景" }], source: "附件資料",
  },
];

const domainRules: Record<string, string[]> = {
  "程式與軟體": ["程式設計", "軟體開發", "運算思維", "資料結構", "演算法", "APP", "互動設計"],
  "資料與 AI": ["資料科學", "AI", "統計", "量化方法"],
  "環境與永續": ["永續", "環境治理", "環境", "污染分析"],
  "政策、法律與治理": ["公共政策", "治理", "科技法律", "倫理", "社會影響"],
  "經濟與決策": ["經濟", "決策", "量化方法"],
  "化學與生醫": ["化學", "基礎科學", "實驗思維", "生醫", "生物"],
};

function courseDomains(course: Course) {
  const direct = course.tags.filter((tag) => Object.hasOwn(domainRules, tag));
  const derived = Object.entries(domainRules).filter(([, keywords]) => keywords.some((keyword) => course.tags.includes(keyword))).map(([domain]) => domain);
  return [...new Set([...direct, ...derived])];
}

function sharedDomains(a: Course, b: Course) {
  const bDomains = new Set(courseDomains(b));
  return courseDomains(a).filter((domain) => bDomains.has(domain));
}

type ApiCourse = {
  id: string; school: School; code: string; titleZh: string; titleEn: string; department: string;
  credits: number; level: Course["level"]; topics: string; teacher?: string; language?: string;
  schedule?: string; semester?: string; description?: string; objectives?: string;
};

function apiCourseToCourse(item: ApiCourse): Course {
  let tags: string[] = [];
  try { tags = JSON.parse(item.topics); } catch { tags = ["其他領域"]; }
  const preferredTopics = new Set(["資料與 AI", "環境與永續", "政策、法律與治理", "設計與創新"]);
  const hasPreferredTopic = tags.some((tag) => preferredTopics.has(tag));
  const contentScore = hasPreferredTopic ? 92 : 68;
  const pathScore = item.level === "研究所" ? 74 : 86;
  const preferenceScore = hasPreferredTopic ? 90 : 65;
  const constraintScore = item.schedule && !item.schedule.includes("待確認") && !item.schedule.includes("請見") ? 90 : 60;
  const fit = Math.round(contentScore * .4 + pathScore * .25 + preferenceScore * .2 + constraintScore * .15);
  const title = item.titleZh || item.titleEn || item.code;
  return {
    id: item.id,
    school: item.school,
    code: item.code,
    title,
    titleEn: item.titleEn || title,
    unit: item.department,
    credits: Number(item.credits) || 0,
    level: item.level === "研究所" ? "研究所" : "大學部",
    language: item.language?.includes("英") ? "英文" : "中文",
    time: item.schedule || "時間待確認",
    teacher: item.teacher || "教師待確認",
    tags,
    semanticTerms: [item.titleEn, item.description ?? "", item.objectives ?? "", ...tags],
    summary: item.description?.trim() || `${item.titleEn || title}，${item.department}於 ${item.semester || "歷年"} 學期開設。`,
    fit,
    reasons: [
      { label: "課程內容（40%）", value: contentScore, note: hasPreferredTopic ? `命中目前偏好：${tags.join("、")}` : `目前分類為${tags.join("、")}` },
      { label: "學習路徑（25%）", value: pathScore, note: item.level === "研究所" ? "研究所課程需再確認先備能力" : "大學部課程適合作為下一步探索" },
      { label: "個人偏好（20%）", value: preferenceScore, note: hasPreferredTopic ? "符合目前設定的資料、永續、治理或跨域偏好" : "與目前示範偏好連結較弱" },
      { label: "時段與限制（15%）", value: constraintScore, note: constraintScore === 90 ? "包含可供檢查的開課時段" : "尚需至校方系統確認時段與限制" },
    ],
    source: item.school === "NTHU" ? "清大官方開放課程資料" : "政大課程資料",
  };
}

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
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [catalogStatus, setCatalogStatus] = useState("正在連接 D1 課程資料庫…");
  const [selected, setSelected] = useState<Course>(featuredMapCourses[0]);
  const [compare, setCompare] = useState<Course[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => typeof window !== "undefined" && localStorage.getItem("course-compass-theme") === "dark" ? "dark" : "light");
  const [account, setAccount] = useState<Account | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [courseDetailsOpen, setCourseDetailsOpen] = useState<Course | null>(null);
  const [saveNotice, setSaveNotice] = useState<number | null>(null);
  const [transcriptCourses, setTranscriptCourses] = useState<TranscriptRow[]>([]);
  const [transcriptRefresh, setTranscriptRefresh] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me").then(async (response) => await response.json() as { user: Account | null }).then((data) => { if (active) setAccount(data.user); }).catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!account) return;
    let active = true;
    void fetch("/api/transcripts").then(async (response) => {
      if (!response.ok) throw new Error();
      return await response.json() as { transcripts: TranscriptHistory[] };
    }).then(({ transcripts }) => {
      if (!active) return;
      const unique = new globalThis.Map<string, TranscriptRow>();
      transcripts.flatMap((record) => record.rows).forEach((row) => unique.set(`${row.courseCode}|${row.courseName}`, row));
      setTranscriptCourses([...unique.values()]);
    }).catch(() => { if (active) setTranscriptCourses([]); });
    return () => { active = false; };
  }, [account, transcriptRefresh]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const statusResponse = await fetch("/api/courses/bootstrap");
        if (!statusResponse.ok) throw new Error("無法讀取匯入狀態");
        let status = await statusResponse.json() as { imported: number; total: number; done: boolean };
        let cursor = status.imported;
        while (!status.done && !cancelled) {
          setCatalogStatus(`正在匯入 D1：${Math.min(cursor, status.total)} / ${status.total} 門`);
          const response = await fetch("/api/courses/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cursor }) });
          if (!response.ok) throw new Error("課程匯入失敗");
          const next = await response.json() as { cursor: number; total: number; done: boolean };
          cursor = next.cursor;
          status = { imported: cursor, total: next.total, done: next.done };
        }
        if (cancelled) return;
        const first = await fetch("/api/courses?page=1&pageSize=500");
        if (!first.ok) throw new Error("無法讀取課程");
        const firstData = await first.json() as { courses: ApiCourse[]; pagination: { pages: number; total: number } };
        const pages = [firstData.courses];
        for (let page = 2; page <= firstData.pagination.pages; page += 1) {
          setCatalogStatus(`正在載入課程：${Math.min((page - 1) * 500, firstData.pagination.total)} / ${firstData.pagination.total}`);
          const response = await fetch(`/api/courses?page=${page}&pageSize=500`);
          if (!response.ok) throw new Error("課程分頁載入失敗");
          const data = await response.json() as { courses: ApiCourse[] };
          pages.push(data.courses);
        }
        if (cancelled) return;
        const loaded = pages.flat().map(apiCourseToCourse);
        setCatalogCourses(loaded);
        setSelected((current) => loaded.find((course) => course.id === current.id) ?? loaded[0] ?? current);
        setCatalogStatus(`D1 已載入 ${loaded.length.toLocaleString("zh-TW")} 門課程`);
      } catch (error) {
        if (!cancelled) setCatalogStatus(error instanceof Error ? error.message : "課程資料載入失敗");
      }
    };
    void loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("course-compass-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogCourses.filter((course) => {
      const literal = [course.title, course.titleEn, course.code, course.unit, ...course.tags].join(" ").toLowerCase();
      const semantic = (course.semanticTerms ?? []).join(" ").toLowerCase();
      const matchesQuery = !q || literal.includes(q) || semantic.includes(q);
      return matchesQuery && (school === "ALL" || course.school === school) && (level === "ALL" || course.level === level) && (language === "ALL" || course.language === language);
    }).sort((a, b) => b.fit - a.fit || a.title.localeCompare(b.title, "zh-Hant"));
  }, [catalogCourses, query, school, level, language]);

  const visibleCourses = filtered.slice(0, 120);

  const learningRecommendations = useMemo(() => {
    const completedKeys = new Set(transcriptCourses.flatMap((row) => [row.courseCode.trim().toLowerCase(), row.courseName.trim().toLowerCase()]));
    const ranked = catalogCourses.filter((course) => course.id !== selected.id && !completedKeys.has(course.code.toLowerCase()) && !completedKeys.has(course.title.toLowerCase())).map((course) => ({
      course,
      score: sharedDomains(selected, course).length * 18 + course.fit,
      reason: sharedDomains(selected, course).length ? `共同主題：${sharedDomains(selected, course).slice(0, 2).join("、")}` : "符合你的學習偏好",
    })).sort((a, b) => b.score - a.score || b.course.fit - a.course.fit);
    const nthu = ranked.filter((item) => item.course.school === "NTHU").slice(0, 2);
    const nccu = ranked.filter((item) => item.course.school === "NCCU").slice(0, 2);
    return [nccu[0], nthu[0], nccu[1], nthu[1]].filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [catalogCourses, selected, transcriptCourses]);

  const resetFilters = () => { setSchool("ALL"); setLevel("ALL"); setLanguage("ALL"); setQuery(""); };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    setTranscriptCourses([]);
    setTranscriptOpen(false);
  };

  return (
    <main className="app-shell min-h-screen">
      <header className="site-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3" onClick={() => setView("discover")}>
            <span className="brand-mark grid h-10 w-10 place-items-center rounded-2xl text-white shadow-sm"><Network size={19} /></span>
            <span className="text-left"><span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6d7773]">Course compass</span><span className="block text-[17px] font-bold tracking-tight">課徑</span></span>
          </button>
          <nav className="ml-auto hidden items-center gap-1 rounded-full border border-black/8 bg-white/65 p-1 sm:flex">
            <button className={`nav-pill ${view === "discover" ? "nav-pill-active" : ""}`} onClick={() => setView("discover")}><Compass size={15} /> 探索</button>
            <button className={`nav-pill ${view === "map" ? "nav-pill-active" : ""}`} onClick={() => setView("map")}><Map size={15} /> 學習路徑</button>
          </nav>
          <button aria-label={theme === "light" ? "切換暗夜主題" : "切換亮色主題"} className="theme-toggle" onClick={toggleTheme}>
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}<span className="hidden lg:inline">{theme === "light" ? "暗夜" : "亮色"}</span>
          </button>
          <button className="relative ml-1 flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5" onClick={() => setCompareOpen(true)}>
            <GitCompareArrows size={17} /><span className="hidden md:inline">自行比較</span><span className="rounded-full bg-[#4f5eb3] px-1.5 py-0.5 text-[10px] text-white">{compare.length}</span>
          </button>
          {account ? <>
            <button className="account-upload-button" onClick={() => setTranscriptOpen(true)}><UploadCloud size={16} /><span className="hidden lg:inline">上傳成績單</span></button>
            <div className="account-chip"><span className="account-avatar"><UserRound size={14} /></span><span className="hidden max-w-28 truncate xl:block">{account.displayName}</span><button aria-label="登出" title="登出" onClick={logout}><LogOut size={14} /></button></div>
          </> : <button className="account-login-button" onClick={() => setAuthOpen(true)}><LogIn size={16} /><span>登入 / 註冊</span></button>}
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 pb-24 sm:px-6 lg:px-8">
        {view === "discover" ? <section className="hero-grid relative overflow-hidden rounded-b-[36px] px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-5 flex items-center gap-2 text-xs font-medium text-white/70"><span className="rounded-full border border-white/25 px-3 py-1">政大選課助手</span><span>成績單辨識</span><span className="h-1 w-1 rounded-full bg-white/75" /><span>個人化推薦</span></div>
            <h1 className="max-w-2xl text-balance text-3xl font-bold leading-[1.15] tracking-[-0.035em] sm:text-5xl">從修過的每一門課，找到最適合你的下一步。</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">登入後上傳政大成績單，確認辨識出的課程與成績，再依你的學習軌跡探索下一門課。</p>
            <div className="hero-search mt-7 flex max-w-3xl items-center gap-2 rounded-2xl p-2 shadow-[0_24px_60px_rgba(0,0,0,.22)]">
              <Search className="ml-2 shrink-0 text-[#6d7773]" size={20} />
              <input aria-label="搜尋課程" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none sm:text-base" placeholder="試試 APP、永續、資料治理…" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="semantic-search-button rounded-xl px-4 py-2.5 text-sm font-bold" onClick={() => setView("discover")}>語意搜尋</button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-white/60"><Sparkles size={13} />不必輸入完整課名，例如 APP 也能找到「程式設計一」。</p>
          </div>
          <div className="hero-orbit hidden lg:block" aria-hidden="true"><span className="orbit-ring orbit-one" /><span className="orbit-ring orbit-two" /><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /><span className="orbit-center"><Sparkles size={24} /></span></div>
        </section> : <LearningPathHero completed={transcriptCourses} selected={selected} recommendations={learningRecommendations} setSelected={setSelected} openTranscript={() => account ? setTranscriptOpen(true) : setAuthOpen(true)} />}

        <div className="mt-5 flex sm:hidden"><button className={`mobile-tab ${view === "discover" ? "mobile-tab-active" : ""}`} onClick={() => setView("discover")}><Compass size={16} />探索</button><button className={`mobile-tab ${view === "map" ? "mobile-tab-active" : ""}`} onClick={() => setView("map")}><Map size={16} />學習路徑</button></div>

        {view === "discover" ? (
          <section className="mt-7 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className={`${filtersOpen ? "block" : "hidden"} xl:block`}>
              <div className="sticky top-24 rounded-3xl border border-black/8 bg-white/80 p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={17} />篩選條件</h2><button className="text-xs font-semibold text-[#d65f43]" onClick={resetFilters}>清除</button></div>
                <FilterGroup label="學校"><FilterButton active={school === "ALL"} onClick={() => setSchool("ALL")}>全部</FilterButton><FilterButton active={school === "NTHU"} onClick={() => setSchool("NTHU")}>清大</FilterButton><FilterButton active={school === "NCCU"} onClick={() => setSchool("NCCU")}>政大</FilterButton></FilterGroup>
                <FilterGroup label="課程層級"><FilterButton active={level === "ALL"} onClick={() => setLevel("ALL")}>全部</FilterButton><FilterButton active={level === "大學部"} onClick={() => setLevel("大學部")}>大學部</FilterButton><FilterButton active={level === "研究所"} onClick={() => setLevel("研究所")}>研究所</FilterButton></FilterGroup>
                <FilterGroup label="授課語言"><FilterButton active={language === "ALL"} onClick={() => setLanguage("ALL")}>全部</FilterButton><FilterButton active={language === "中文"} onClick={() => setLanguage("中文")}>中文</FilterButton><FilterButton active={language === "英文"} onClick={() => setLanguage("英文")}>英文</FilterButton></FilterGroup>
                <div className="mt-6 rounded-2xl bg-[#f3eff7] p-4"><div className="flex items-center gap-2 text-xs font-bold"><Sparkles size={15} className="text-[#76558f]" />你的推薦偏好</div><div className="mt-3 flex flex-wrap gap-1.5">{["永續", "資料科學", "公共議題", "跨領域"].map((item) => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#625a68]">{item}</span>)}</div><button className="mt-3 flex items-center gap-1 text-xs font-bold text-[#6a3a8c]">調整偏好 <ArrowRight size={12} /></button></div>
              </div>
            </aside>

            <div>
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#89918e]">Personalized discovery</p><h2 className="mt-1 text-2xl font-bold tracking-tight">為你挑選的課程</h2></div><button className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-bold xl:hidden" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal size={15} /> 篩選</button></div>
              <div className="mb-4 flex flex-wrap gap-2"><span className="filter-summary"><University size={13} />{school === "ALL" ? "兩校" : schoolLabel[school]}</span><span className="filter-summary"><GraduationCap size={13} />{level === "ALL" ? "所有層級" : level}</span><span className="filter-summary"><Languages size={13} />{language === "ALL" ? "所有語言" : language}</span><span className="ml-auto self-center text-xs text-[#6d7773]">{catalogStatus}・符合 {filtered.length.toLocaleString("zh-TW")} 門</span></div>
              {query.trim() && filtered.some((course) => !(course.title + course.titleEn + course.code + course.unit + course.tags.join("")).toLowerCase().includes(query.trim().toLowerCase())) && <div className="semantic-hint mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs leading-5"><Sparkles size={15} className="mt-0.5 shrink-0" /><span><strong>語意延伸：</strong>「{query.trim()}」可能代表應用開發需求，因此也推薦沒有相同字面的基礎課程。</span></div>}
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleCourses.map((course) => (
                  <article key={course.id} className={`course-card group ${selected.id === course.id ? "course-card-selected" : ""}`} onClick={() => { setSelected(course); setCourseDetailsOpen(course); }}>
                    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><SchoolBadge school={course.school} /><span className="text-[11px] font-bold tracking-wide text-[#7d8783]">{course.code}</span></div><button aria-label="收藏課程" className={`icon-button ${saved.includes(course.id) ? "icon-button-saved" : ""}`} onClick={(event) => { event.stopPropagation(); setSaved((items) => items.includes(course.id) ? items.filter((id) => id !== course.id) : [...items, course.id]); }}><Heart size={16} fill={saved.includes(course.id) ? "currentColor" : "none"} /></button></div>
                    <h3 className="mt-4 text-lg font-bold tracking-tight">{course.title}</h3><p className="mt-1 line-clamp-1 text-xs text-[#77817d]">{course.titleEn}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#53605c]">{course.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">{course.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div>
                    <div className="mt-5 flex items-end justify-between border-t border-black/7 pt-4"><div className="space-y-1 text-[11px] text-[#6d6872]"><p className="flex items-center gap-1.5"><Clock3 size={12} />{course.time}</p><p className="flex items-center gap-1.5"><BookOpen size={12} />{course.credits} 學分・{course.unit}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8490]">推薦參考</p><p className="text-2xl font-black tracking-tight text-[#76558f]">{course.fit}<span className="text-xs">%</span></p></div></div>
                  </article>
                ))}
              </div>
              {filtered.length > visibleCourses.length && <p className="mt-4 text-center text-xs text-[#7b7480]">目前顯示前 {visibleCourses.length} 門；輸入課名、課號或主題可縮小結果。</p>}
              {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-black/15 bg-white/50 px-6 py-16 text-center"><Search className="mx-auto text-[#9aa29f]" /><h3 className="mt-3 font-bold">沒有符合條件的課程</h3><p className="mt-1 text-sm text-[#75807c]">試著清除部分篩選條件或換一個關鍵字。</p><button className="mt-4 text-sm font-bold text-[#d65f43]" onClick={resetFilters}>清除全部</button></div>}
            </div>
          </section>
        ) : <RecommendationMap selected={selected} setSelected={setSelected} compare={compare} openDetails={setCourseDetailsOpen} recommendations={learningRecommendations} />}
      </div>
      {compareOpen && <CompareModal courses={compare} allCourses={catalogCourses} setCourses={setCompare} close={() => setCompareOpen(false)} remove={(course) => setCompare((items) => items.filter((item) => item.id !== course.id))} />}
      {authOpen && <AuthDialog close={() => setAuthOpen(false)} onAuthenticated={(user) => { setAccount(user); setAuthOpen(false); setTranscriptOpen(true); }} />}
      {transcriptOpen && account && <TranscriptDialog account={account} close={() => setTranscriptOpen(false)} onSaved={(count) => { setTranscriptOpen(false); setSaveNotice(count); setTranscriptRefresh((value) => value + 1); }} />}
      {courseDetailsOpen && <CourseDetailsModal course={courseDetailsOpen} close={() => setCourseDetailsOpen(null)} />}
      {saveNotice !== null && <SaveSuccessDialog count={saveNotice} close={() => setSaveNotice(null)} />}
    </main>
  );
}

function AuthDialog({ close, onAuthenticated }: { close: () => void; onAuthenticated: (user: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setStatus("");
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, displayName }) });
      const data = await response.json() as { user?: Account; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? "操作失敗");
      onAuthenticated(data.user);
    } catch (error) { setStatus(error instanceof Error ? error.message : "操作失敗"); }
    finally { setSubmitting(false); }
  };
  return <div className="modal-backdrop" onMouseDown={close}><div className="auth-dialog" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" aria-label="關閉" onClick={close}><X size={17} /></button>
    <div className="auth-brand"><span><ShieldCheck size={22} /></span><div><p>Course Compass</p><h2>{mode === "login" ? "歡迎回來" : "建立你的課徑帳號"}</h2></div></div>
    <p className="auth-description">登入後才能上傳成績單。原始檔只用於辨識，不會存進資料庫。</p>
    <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登入</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>註冊</button></div>
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && <label><span>顯示名稱</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={40} required placeholder="例如：小政" /></label>}
      <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@example.com" /></label>
      <label><span>密碼</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="至少 8 個字元" /></label>
      {status && <p className="form-error"><AlertTriangle size={14} />{status}</p>}
      <button className="primary-action" disabled={submitting}>{submitting && <LoaderCircle className="animate-spin" size={16} />}{mode === "login" ? "登入並繼續" : "註冊並繼續"}</button>
    </form>
    <p className="privacy-note"><ShieldCheck size={13} />密碼以 PBKDF2 雜湊保存，不會保存明文。</p>
  </div></div>;
}

const sampleTranscriptRows: TranscriptRow[] = [
  { id: "sample-1", term: "110-1", courseCode: "000219011", courseName: "經濟學", credits: 3, gradeRaw: "84.00", confidence: .98 },
  { id: "sample-2", term: "110-1", courseCode: "000314011", courseName: "初級會計學（一）", credits: 3, gradeRaw: "88.00", confidence: .97 },
  { id: "sample-3", term: "112-1", courseCode: "000359011", courseName: "統計學（一）", credits: 3, gradeRaw: "W", confidence: .86 },
  { id: "sample-4", term: "113-1", courseCode: "046001001", courseName: "程式設計概論", credits: 3, gradeRaw: "93.00", confidence: .94 },
];

function TranscriptDialog({ account, close, onSaved }: { account: Account; close: () => void; onSaved: (count: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<TranscriptHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch("/api/transcripts").then(async (response) => {
      const data = await response.json() as { transcripts?: TranscriptHistory[] };
      if (!response.ok) throw new Error();
      return data.transcripts ?? [];
    }).then((items) => { if (active) setHistory(items); }).catch(() => { if (active) setHistory([]); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, []);
  const updateRow = (id: string, patch: Partial<TranscriptRow>) => setRows((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const runOcr = async () => {
    if (!file) { setStatus("請先選擇 PDF 或圖片"); return; }
    setProcessing(true); setStatus("正在辨識版面、課程名稱與成績…"); setSaved(false);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/ocr/transcript", { method: "POST", body: form });
      const data = await response.json() as { rows?: TranscriptRow[]; error?: string };
      if (!response.ok || !data.rows) throw new Error(data.error ?? "辨識失敗");
      setRows(data.rows); setStatus(`已辨識 ${data.rows.length} 門課，請逐列確認。`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "辨識失敗"); }
    finally { setProcessing(false); }
  };
  const loadSample = () => { setRows(sampleTranscriptRows); setStatus("已載入範例辨識結果，可直接測試編輯與確認流程。"); setSaved(false); };
  const saveRows = async () => {
    setProcessing(true); setStatus("正在保存確認結果…");
    try {
      const response = await fetch("/api/transcripts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: file?.name ?? "範例成績單", fileType: file?.type ?? "sample", rows }) });
      const data = await response.json() as { transcript?: { rows: number }; error?: string };
      if (!response.ok) throw new Error(data.error ?? "儲存失敗");
      const savedCount = data.transcript?.rows ?? rows.length;
      setSaved(true); setStatus(`已確認並保存 ${savedCount} 門課。`); onSaved(savedCount);
    } catch (error) { setStatus(error instanceof Error ? error.message : "儲存失敗"); }
    finally { setProcessing(false); }
  };
  return <div className="modal-backdrop transcript-backdrop" onMouseDown={close}><div className="transcript-dialog" onMouseDown={(event) => event.stopPropagation()}>
    <header className="transcript-header"><div><p className="eyebrow">NCCU TRANSCRIPT OCR</p><h2><ScanLine size={22} />成績單辨識與確認</h2><p>{account.displayName}，請確認每一列再保存到個人學習紀錄。</p></div><button className="modal-close static" aria-label="關閉" onClick={close}><X size={17} /></button></header>
    <section className="transcript-history"><div className="transcript-history-heading"><div><p className="eyebrow">SAVED RECORDS</p><h3><History size={17} />過去 OCR 紀錄</h3></div><span>{history.length} 份</span></div>
      {historyLoading ? <p className="history-empty">正在讀取紀錄…</p> : history.length ? <div className="history-card-list">{history.map((item) => <button key={item.id} className="history-card" onClick={() => { setFile(null); setRows(item.rows.map((row) => ({ ...row, id: `${item.id}-${row.id}` }))); setStatus(`已載入「${item.fileName}」的 ${item.rows.length} 門課，可直接查看或修改。`); setSaved(false); }}><span className="history-card-icon"><FileText size={17} /></span><span className="min-w-0 flex-1"><strong>{item.fileName}</strong><small>{new Date(item.confirmedAt ?? item.createdAt).toLocaleString("zh-TW")}・{item.rows.length} 門課</small></span><ArrowRight size={15} /></button>)}</div> : <p className="history-empty">尚無紀錄。第一次確認保存後，以後可以直接從這裡打開，不必重傳成績單。</p>}
    </section>
    <section className="upload-panel">
      <div className="upload-icon"><UploadCloud size={24} /></div><div className="min-w-0 flex-1"><h3>{file ? file.name : "選擇政大成績單"}</h3><p>支援 PDF、JPG、PNG、WebP，最大 10 MB。原始檔不會保存。</p></div>
      <label className="secondary-action">選擇檔案<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <button className="primary-action compact" onClick={runOcr} disabled={!file || processing}>{processing ? <LoaderCircle className="animate-spin" size={16} /> : <ScanLine size={16} />}開始 OCR</button>
    </section>
    <div className="transcript-toolbar"><p className={saved ? "success-message" : ""}>{status || "尚未開始辨識"}</p><button onClick={loadSample}>沒有 API key？載入範例結果</button></div>
    {rows.length ? <div className="transcript-table-wrap"><table className="transcript-table"><thead><tr><th>學期</th><th>課程代號</th><th>課程名稱</th><th>學分</th><th>成績</th><th>比對</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
      <td><input value={row.term} onChange={(event) => updateRow(row.id, { term: event.target.value })} /></td>
      <td>{row.candidates?.length ? <select value={row.courseCode} onChange={(event) => { const candidate = row.candidates?.find((item) => item.code === event.target.value); updateRow(row.id, { courseCode: event.target.value, courseName: candidate?.title ?? row.courseName, confidence: candidate?.confidence ?? row.confidence }); }}>{row.candidates.map((candidate) => <option key={candidate.code} value={candidate.code}>{candidate.code}</option>)}</select> : <input value={row.courseCode} onChange={(event) => updateRow(row.id, { courseCode: event.target.value })} />}</td>
      <td><input className="course-name-input" value={row.courseName} onChange={(event) => updateRow(row.id, { courseName: event.target.value })} /></td>
      <td><input type="number" min="0" max="20" step="0.5" value={row.credits ?? ""} onChange={(event) => updateRow(row.id, { credits: event.target.value === "" ? null : Number(event.target.value) })} /></td>
      <td><input value={row.gradeRaw} onChange={(event) => updateRow(row.id, { gradeRaw: event.target.value })} /></td>
      <td><span className={`confidence-badge ${row.confidence >= .9 ? "high" : row.confidence >= .7 ? "medium" : "low"}`}>{Math.round(row.confidence * 100)}%</span></td>
      <td><button aria-label="移除這列" className="mini-action danger" onClick={() => setRows((items) => items.filter((item) => item.id !== row.id))}><Trash2 size={14} /></button></td>
    </tr>)}</tbody></table></div> : <div className="ocr-empty"><FileText size={30} /><h3>辨識結果會顯示在這裡</h3><p>課程代號是依課名、學期與學分從 2,446 門政大課程中推測，請務必人工確認。</p></div>}
    <footer className="transcript-footer"><p><ShieldCheck size={14} />只保存你確認的課程列；姓名、學號與原始檔不會保存。</p><button className="primary-action compact" onClick={saveRows} disabled={!rows.length || processing || saved}>{saved ? <><Check size={16} />已保存</> : <><Save size={16} />確認並保存</>}</button></footer>
  </div></div>;
}

type CourseApiDetail = {
  description: string;
  objectives: string;
  prerequisites: string;
  offeredTerms: string[];
  syllabusSource: string;
  syllabusUrl: string;
  requirement: string;
  teacher?: string;
  language?: string;
  source?: string;
};

function CourseDetailsModal({ course, close }: { course: Course; close: () => void }) {
  const [detail, setDetail] = useState<CourseApiDetail | null>(null);
  const [status, setStatus] = useState("正在載入課程資料…");
  useEffect(() => {
    let active = true;
    void fetch(`/api/courses/${encodeURIComponent(course.id)}`).then(async (response) => {
      const data = await response.json() as { course?: CourseApiDetail; error?: string };
      if (!response.ok || !data.course) throw new Error(data.error ?? "讀取課程資料失敗");
      return data.course;
    }).then((data) => { if (active) { setDetail(data); setStatus(""); } }).catch((error) => { if (active) setStatus(error instanceof Error ? error.message : "讀取課程資料失敗"); });
    return () => { active = false; };
  }, [course.id]);
  return <div className="modal-backdrop" onMouseDown={close}><div className="course-info-dialog" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" aria-label="關閉" onClick={close}><X size={17} /></button>
    <div className="course-info-hero"><div className="flex items-center gap-2"><SchoolBadge school={course.school} /><span className="text-xs font-bold text-white/55">{course.code}</span></div><h2>{course.title}</h2><p className="course-info-en">{course.titleEn}</p><div className="course-info-meta"><span>{course.unit}</span><span>{course.credits} 學分</span><span>{course.level}</span><span>{course.language}</span></div></div>
    <div className="course-info-body">
      {status ? <p className="course-info-status">{status}</p> : <>
        <section><h3>課程簡介</h3><p>{detail?.description}</p></section>
        {detail?.objectives && <section><h3>課程目標與學習成效</h3><p>{detail.objectives}</p></section>}
        <div className="course-info-grid"><section><h3>授課教師</h3><p>{detail?.teacher || course.teacher}</p></section><section><h3>先修與限制</h3><p>{detail?.prerequisites || "無資料，請以校方系統為準"}</p></section><section><h3>曾開課學期</h3><p>{detail?.offeredTerms?.slice(0, 8).join("、") || "尚無資料"}</p></section><section><h3>資料來源</h3><p>{course.school === "NCCU" ? "政大歷年課程資料" : detail?.source || course.source}</p></section></div>
        <a className="official-syllabus-link" href={detail?.syllabusUrl || (course.school === "NCCU" ? "https://qrysub.nccu.edu.tw/" : "https://curricul.site.nthu.edu.tw/p/406-1208-290365,r7880.php?Lang=zh-tw")} target="_blank" rel="noreferrer"><ExternalLink size={16} />{course.school === "NCCU" ? "前往政大官方課程大綱" : "查看清大課程大綱／查詢系統"}</a>
      </>}
      <div className="fit-explainer"><h3>推薦參考分數如何計算？</h3><p>課程內容 40%＋學習路徑 25%＋目前偏好 20%＋時段與限制 15%。目前偏好仍是畫面上的示範設定；成績單正式接入推薦模型後，才會依已修課與成績動態調整。</p></div>
    </div>
  </div></div>;
}

function SaveSuccessDialog({ count, close }: { count: number; close: () => void }) {
  return <div className="modal-backdrop save-success-backdrop" onMouseDown={close}><div className="save-success-dialog" role="dialog" aria-modal="true" aria-labelledby="save-success-title" onMouseDown={(event) => event.stopPropagation()}><span className="save-success-icon"><Check size={28} /></span><p className="eyebrow">TRANSCRIPT SAVED</p><h2 id="save-success-title">成績單已保存</h2><p>已將你確認的 {count} 門課加入個人學習紀錄，確認頁面已收起。</p><button className="primary-action" onClick={close}>完成</button></div></div>;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="mb-5"><p className="mb-2 text-xs font-bold text-[#64706c]">{label}</p><div className="flex flex-wrap gap-2">{children}</div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`filter-button ${active ? "filter-button-active" : ""}`} onClick={onClick}>{active && <Check size={11} />}{children}</button>; }

function LearningPathHero({ completed, selected, recommendations, setSelected, openTranscript }: { completed: TranscriptRow[]; selected: Course; recommendations: { course: Course; score: number; reason: string }[]; setSelected: (course: Course) => void; openTranscript: () => void }) {
  const visibleCompleted = completed.slice(0, 4);
  return <section className="learning-hero rounded-b-[36px] px-5 py-6 sm:px-8 lg:px-10">
    <div className="learning-hero-heading">
      <div><p className="eyebrow">PERSONAL LEARNING MAP</p><h1>從已修課，連到你的下一個目標</h1><p>灰色是成績單辨識出的已修課；藍色為政大、紫色為清大推薦課程。</p></div>
      <div className="learning-map-legend"><span><i className="legend-completed" />已修課</span><span><i className="legend-nccu" />政大</span><span><i className="legend-nthu" />清大</span></div>
    </div>
    <div className="learning-graph">
      <svg className="learning-graph-lines" viewBox="0 0 1200 360" preserveAspectRatio="none" aria-hidden="true">
        <path className="line-completed" d="M255 48 C390 48 405 180 520 180" /><path className="line-completed" d="M255 136 C390 136 405 180 520 180" /><path className="line-completed" d="M255 224 C390 224 405 180 520 180" /><path className="line-completed" d="M255 312 C390 312 405 180 520 180" />
        <path className="line-nccu" d="M680 180 C790 180 820 48 945 48" /><path className="line-nthu" d="M680 180 C790 180 820 136 945 136" /><path className="line-nccu" d="M680 180 C790 180 820 224 945 224" /><path className="line-nthu" d="M680 180 C790 180 820 312 945 312" />
      </svg>
      <div className="learning-completed-column">
        {visibleCompleted.length ? visibleCompleted.map((row) => <div key={`${row.courseCode}-${row.courseName}`} className="learning-node completed-node"><span><Check size={13} /></span><div><small>{row.courseCode || "已修課"}・{row.gradeRaw || "成績已保存"}</small><strong>{row.courseName}</strong></div></div>) : <button className="learning-node completed-node empty-completed" onClick={openTranscript}><span><UploadCloud size={14} /></span><div><small>尚無成績單資料</small><strong>登入並上傳成績單</strong></div></button>}
      </div>
      <div className="learning-goal-node"><span>目前目標</span><strong>{selected.title}</strong><small>{schoolLabel[selected.school]}・{selected.code}</small></div>
      <div className="learning-recommendation-column">
        {recommendations.map((item) => <button key={item.course.id} className={`learning-node recommendation-node ${item.course.school === "NCCU" ? "node-nccu" : "node-nthu"}`} onClick={() => setSelected(item.course)}><span>{item.course.school === "NCCU" ? "政" : "清"}</span><div><small>{item.course.code}・{item.reason}</small><strong>{item.course.title}</strong></div><b>{item.course.fit}%</b></button>)}
      </div>
    </div>
  </section>;
}

function RecommendationMap({ selected, setSelected, compare, openDetails, recommendations }: { selected: Course; setSelected: (course: Course) => void; compare: Course[]; openDetails: (course: Course) => void; recommendations: { course: Course; score: number; reason: string }[] }) {
  type SavedMap = { id: string; name: string; payload: string; createdAt: string; updatedAt: string };
  const [mapName, setMapName] = useState("我的學習路徑");
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState("");
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadMaps = async () => {
    try {
      const response = await fetch("/api/maps");
      if (!response.ok) throw new Error();
      const data = await response.json() as { maps: SavedMap[] };
      setSavedMaps(data.maps);
    } catch { setMapStatus("登入後即可同步學習路徑"); }
  };
  useEffect(() => {
    let active = true;
    void fetch("/api/maps").then(async (response) => {
      if (!response.ok) throw new Error();
      return await response.json() as { maps: SavedMap[] };
    }).then((data) => { if (active) setSavedMaps(data.maps); }).catch(() => { if (active) setMapStatus("登入後即可同步學習路徑"); });
    return () => { active = false; };
  }, []);

  const saveMap = async () => {
    setMapStatus("儲存中…");
    const response = await fetch("/api/maps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: mapName, payload: { selectedId: selected.id, compareIds: compare.map((item) => item.id), courseIds: featuredMapCourses.map((course) => course.id) } }) });
    setMapStatus(response.ok ? "已儲存到你的帳號" : "儲存失敗，請確認已登入");
    if (response.ok) { await loadMaps(); setHistoryOpen(true); }
  };
  const renameMap = async (map: SavedMap, name: string) => {
    name = name.trim();
    if (!name) return;
    const response = await fetch(`/api/maps/${map.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (response.ok) { await loadMaps(); setEditingMapId(null); setEditingName(""); }
  };
  const deleteMap = async (map: SavedMap) => {
    const response = await fetch(`/api/maps/${map.id}`, { method: "DELETE" });
    if (response.ok) { await loadMaps(); setDeleteConfirmId(null); }
  };
  const openMap = (map: SavedMap) => {
    try {
      const payload = JSON.parse(map.payload) as { selectedId?: string };
      const course = featuredMapCourses.find((item) => item.id === payload.selectedId);
      if (course) setSelected(course);
      setMapName(map.name);
      setMapStatus(`已載入「${map.name}」`);
    } catch { setMapStatus("這筆學習路徑無法讀取"); }
  };
  return (
    <section className="mt-7">
      <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#89828f]">PATH SETTINGS</p><h2 className="mt-1 text-2xl font-bold tracking-tight">管理這條學習路徑</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6d6772]">上方地圖已呈現已修課、目前目標與兩校推薦；這裡只保留儲存、歷史紀錄與目標說明。</p></div>
      <div className="map-savebar mb-5 rounded-2xl border p-3 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="flex min-w-0 flex-1 items-center gap-2"><Save size={16} /><input aria-label="學習路徑名稱" className="map-name-input min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none" value={mapName} onChange={(event) => setMapName(event.target.value)} maxLength={80} /></div><button className="save-map-button rounded-xl px-4 py-2.5 text-xs font-bold" onClick={saveMap}>儲存目前路徑</button><button className="history-button flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold" onClick={() => setHistoryOpen((open) => !open)}><History size={15} />已保存路徑 <span>{savedMaps.length}</span></button></div>{mapStatus && <p className="mt-2 text-[11px] text-muted-foreground">{mapStatus}</p>}
        {historyOpen && <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-2 xl:grid-cols-3">{savedMaps.length ? savedMaps.map((map) => <div key={map.id} className="saved-map-row flex items-center gap-2 rounded-xl border p-3">{editingMapId === map.id ? <><input aria-label="新的地圖名稱" className="map-name-input min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button aria-label="保存名稱" className="mini-action" onClick={() => renameMap(map, editingName)}><Check size={13} /></button><button aria-label="取消改名" className="mini-action" onClick={() => setEditingMapId(null)}><X size={13} /></button></> : <><button className="min-w-0 flex-1 text-left" onClick={() => openMap(map)}><span className="block truncate text-xs font-bold">{map.name}</span><span className="mt-1 block text-[10px] text-muted-foreground">{new Date(map.updatedAt).toLocaleString("zh-TW")}</span></button><button aria-label="重新命名" className="mini-action" onClick={() => { setEditingMapId(map.id); setEditingName(map.name); setDeleteConfirmId(null); }}><Pencil size={13} /></button>{deleteConfirmId === map.id ? <button aria-label="確認刪除" className="mini-action danger confirm-delete" onClick={() => deleteMap(map)}>確定</button> : <button aria-label="刪除地圖" className="mini-action danger" onClick={() => { setDeleteConfirmId(map.id); setEditingMapId(null); }}><Trash2 size={13} /></button>}</>}</div>) : <p className="py-3 text-xs text-muted-foreground">尚無紀錄，替目前路徑命名後儲存。</p>}</div>}
      </div>
      <div className="learning-path-layout">
        <div className="learning-path-board"><div className="path-focus-card"><div><p className="eyebrow">目前起點</p><div className="mt-2 flex items-center gap-2"><SchoolBadge school={selected.school} /><span className="text-xs font-bold text-[#7d8783]">{selected.code}</span></div><h3>{selected.title}</h3><p>{selected.summary}</p><button className="path-inline-detail" onClick={() => openDetails(selected)}><BookOpen size={14} />查看課程簡介與學習目標</button></div><div className="path-focus-score"><span>{selected.fit}%</span><small>推薦參考</small></div></div>
          <div className="path-card-grid mt-4">{recommendations.map((item, index) => <button key={item.course.id} className="path-course-card" onClick={() => setSelected(item.course)}><span className={`path-step ${item.course.school === "NCCU" ? "path-step-nccu" : "path-step-nthu"}`}>{index + 1}</span><div className="min-w-0 flex-1"><small>{schoolLabel[item.course.school]}・{item.course.code}</small><strong>{item.course.title}</strong><em>{item.reason}</em></div><span className="path-score">{item.course.fit}%</span></button>)}</div>
          <div className="path-method-note"><Sparkles size={17} /><div><strong>推薦會怎麼判斷？</strong><p>搜尋提示詞、課程簡介與課程目標是主要語意來源，再搭配已修課紀錄、偏好與選課限制。現在先呈現可解釋的課程關聯。</p></div></div>
        </div>
      </div>
    </section>
  );
}

function CompareModal({ courses, allCourses, setCourses, close, remove }: { courses: Course[]; allCourses: Course[]; setCourses: React.Dispatch<React.SetStateAction<Course[]>>; close: () => void; remove: (course: Course) => void }) {
  const [targets, setTargets] = useState([courses[0]?.title ?? "", courses[1]?.title ?? ""]);
  const [chosen, setChosen] = useState<[Course | null, Course | null]>([courses[0] ?? null, courses[1] ?? null]);
  const compatibleWithA = chosen[0] ? allCourses.filter((course) => course.id !== chosen[0]?.id && sharedDomains(chosen[0]!, course).length > 0) : [];
  const chooseTarget = (index: number, value: string) => {
    setTargets((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
    const normalized = value.trim().toLowerCase();
    const available = index === 0 ? allCourses : compatibleWithA;
    const match = available.find((course) => course.title.toLowerCase() === normalized || course.code.toLowerCase() === normalized || `${course.title}｜${schoolLabel[course.school]}・${course.code}`.toLowerCase() === normalized);
    if (!match) return;
    if (index === 0) {
      setChosen([match, null]);
      setTargets([value, ""]);
      setCourses([match]);
      return;
    }
    setChosen((items) => {
      if (items.some((item, itemIndex) => item?.id === match.id && itemIndex !== index)) return items;
      const next: [Course | null, Course | null] = [...items];
      next[index] = match;
      setCourses(next.filter((item): item is Course => Boolean(item)));
      return next;
    });
  };
  const selectedCourses = chosen.filter((item): item is Course => Boolean(item));
  const removeTarget = (course: Course) => {
    if (chosen[0]?.id === course.id) {
      setChosen([null, null]);
      setTargets(["", ""]);
      setCourses([]);
      return;
    }
    setChosen([chosen[0], null]);
    setTargets([targets[0], ""]);
    remove(course);
  };
  const overlap = selectedCourses.length === 2 ? sharedDomains(selectedCourses[0], selectedCourses[1]) : [];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#211a29]/45 p-4 backdrop-blur-sm" onMouseDown={close}><div className="compare-modal max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[30px] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="compare-header sticky top-0 z-10 flex items-center justify-between border-b px-6 py-5 backdrop-blur"><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#89828f]">Course comparison</p><h2 className="mt-1 text-xl font-bold">自行選擇比較標的</h2></div><button className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white" onClick={close}><X size={17} /></button></div>
    <div className="border-b px-5 py-5 sm:px-7"><p className="mb-3 text-xs leading-5 text-[#726b78]">先輸入標的 A。標的 B 只會顯示與 A 有共同主題或學習路徑的課程。</p><div className="grid gap-3 md:grid-cols-2">{[0, 1].map((index) => { const options = index === 0 ? allCourses : compatibleWithA; return <label key={index} className="compare-target"><span>比較標的 {index === 0 ? `A・全部 ${allCourses.length} 門` : `B・相容 ${options.length} 門`}</span><input list={`course-options-${index}`} placeholder={index === 0 ? "先輸入課名或課號…" : chosen[0] ? "只顯示可比較課程…" : "請先選擇標的 A"} value={targets[index]} disabled={index === 1 && !chosen[0]} onChange={(event) => chooseTarget(index, event.target.value)} /><datalist id={`course-options-${index}`}>{options.map((course) => <option key={course.id} value={`${course.title}｜${schoolLabel[course.school]}・${course.code}`} />)}</datalist></label>; })}</div>{chosen[0] && <p className="mt-3 text-[11px] text-[#7b7480]">依「{courseDomains(chosen[0]).join("、")}」篩選，已隱藏 {allCourses.length - compatibleWithA.length - 1} 門不相容課程。</p>}</div>
    {selectedCourses.length < 2 || overlap.length === 0 ? <div className="px-6 py-14 text-center"><GitCompareArrows className="mx-auto text-[#aaa3ae]" /><h3 className="mt-3 font-bold">{selectedCourses.length === 2 ? "目前的標的 B 與 A 不相容，請重新選擇" : chosen[0] ? `請從 ${compatibleWithA.length} 門相容課程選擇標的 B` : "請先輸入比較標的 A"}</h3><p className="mt-1 text-sm text-[#7b7480]">不相容的課程已從標的 B 選項中移除。</p></div> : <div className="p-5 sm:p-7"><div className="grid grid-cols-[120px_repeat(2,minmax(0,1fr))] gap-x-4 gap-y-0 text-sm max-sm:grid-cols-[88px_repeat(2,minmax(0,1fr))]"><div />{selectedCourses.map((course) => <div key={course.id} className="relative rounded-2xl bg-white p-4 shadow-sm"><button className="absolute right-3 top-3 text-[#98919d]" onClick={() => removeTarget(course)}><X size={14} /></button><SchoolBadge school={course.school} /><h3 className="mt-3 font-bold leading-5">{course.title}</h3><p className="mt-1 text-[10px] text-[#7c7582]">{course.code}</p><p className="mt-4 text-3xl font-black text-[#76558f]">{course.fit}<span className="text-xs">%</span></p></div>)}<CompareRow label="學分" values={selectedCourses.map((course) => `${course.credits} 學分`)} /><CompareRow label="系所" values={selectedCourses.map((course) => course.unit)} /><CompareRow label="時間" values={selectedCourses.map((course) => course.time)} /><CompareRow label="語言" values={selectedCourses.map((course) => course.language)} /><CompareRow label="核心主題" values={selectedCourses.map((course) => course.tags.join("、"))} /><CompareRow label="定位" values={selectedCourses.map((course) => course.summary)} tall /></div><div className="mt-6 rounded-2xl border border-[#d8c8e3] bg-[#f7f1fb] p-5"><p className="flex items-center gap-2 text-sm font-bold"><Sparkles size={16} className="text-[#76558f]" />比較判讀</p><p className="mt-2 text-sm leading-6 text-[#625a68]">兩門課共有「{overlap.join("、")}」學習領域，可進一步比較課程內容、學分與時段。</p><p className="mt-2 text-[11px] text-[#847b8b]">比較結果不等同正式學分抵免認定。</p></div></div>}</div></div>;
}
function CompareRow({ label, values, tall = false }: { label: string; values: string[]; tall?: boolean }) { return <><div className={`border-b border-black/7 py-4 text-xs font-bold text-[#6c7672] ${tall ? "leading-6" : ""}`}>{label}</div>{values.map((value, index) => <div key={`${label}-${index}`} className={`border-b border-black/7 py-4 text-xs leading-5 text-[#46534f] ${tall ? "min-h-28" : ""}`}>{value}</div>)}</>; }
