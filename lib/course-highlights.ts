const objectiveHeading = String.raw`課程(?:目標(?:與學習成效)?|目的)|(?:預期)?學習(?:目標|成效|成果|結果)|(?:course )?(?:goals?|objectives?|aims?)|(?:(?:expected|intended) )?learning (?:goals?|objectives?|outcomes?)`;
const descriptionHeading = String.raw`課程(?:說明|簡介|概述|內容|大綱)|course (?:description|overview|content)`;
const otherHeading = String.raw`先修(?:科目|條件|課程|知識)(?:或先備能力)?|先備(?:知識|能力)|指定(?:用書|書籍|教材)|參考(?:書籍|資料|書目)(?:/樂譜)?|教學(?:方式|方法|進度)|授課(?:方式|對象)|課程(?:進度|要求|規定)|(?:成績|評分)(?:考核|評量|方式|標準|比例|計算)|可連結之網頁位址|AI使用規則|prerequisites?|text ?books?|references?|teaching (?:methods?|approach)|(?:course )?(?:schedule|evaluation|assessment|grading|requirements|policies)|syllabus`;
const sectionNumber = String.raw`[一二三四五六七八九十]+[、.．]|\([IVX\d]+\)|[IVX\d]+[.、)]`;
const heading = new RegExp(
  String.raw`^(?:[>*#●•-]+\s*)?(?:${sectionNumber})?\s*(?:(?<outcome>${objectiveHeading})|(?<topic>${descriptionHeading})|(?<other>${otherHeading}))(?:\s*[（(][^()（）]*[)）]| +(?:${objectiveHeading}|${descriptionHeading}|${otherHeading}))?(?:\s*[:：]\s*(?<content>.*))?\s*$`,
  "iu",
);
const inlineHeading = new RegExp(String.raw` {2,}(?=(?:${sectionNumber})?\s*[【[]?(?:${objectiveHeading}|${descriptionHeading}|${otherHeading})(?:\s|[:：(（】\]]|$))`, "iu");
const itemNumber = /[（(]\s*[\d一二三四五六七八九十]{1,2}\s*[）)]/gu;
const numberedItem = /^(?:[•●▪◦◆◇*＊※]|[-–—](?=\s)|(?:\(?\d{1,2}[.、．)]|[（(]\s*[\d一二三四五六七八九十]{1,2}\s*[）)]|[一二三四五六七八九十]+[、.．]))\s*(?!\d)/u;
const topical = /涵蓋|探討|介紹|認識|比較|分析|設計|理解|了解|辨識|培養|掌握|應用|運用|練習|學習|\b(?:apply|analy[sz]e|compare|cover|describe|design|discuss|examine|explain|explore|focus|identify|introduc\w+|learn|practi[cs]e|recognize|study|topics?)\b/iu;
const outcome = /^(?:本)?課程(?:目標|目的)(?:是|為|在於)|(?:使|讓)(?:學生|學員|修課者|同學)具有.{0,70}?(?:能力|素養|技巧|技能|知識)|(?:學生|學員|修課者|同學).{0,32}?(?:將(?:能)?|應能|可望|可以|能夠|能|得以)(?:了解|理解|認識|熟悉|掌握|辨識|應用|運用|分析|比較|說明|解釋|評估|設計|發展|練習|學習|具備|建立)|(?:培養|提升|增進|強化|訓練).{0,60}?(?:能力|素養|技巧|技能|知識)|\b(?:students?|learners?|you)\b.{0,36}?\b(?:will|can|should be able to|will be able to)\s+(?:learn|understand|identify|design|interpret|assess|apply|analy[sz]e|compare|create|demonstrate|describe|develop|evaluate|explain|recognize|use)\b|\b(?:aims?|intended) to (?:develop|build|prepare|equip|help students)\b/iu;
const imperative = /^(?:了解|瞭解|理解|認識|熟悉|應用|分析|解釋|評估|設計|描述|辨識|比較|培養|提升|掌握|建立|具備|以.+(?:分析|支持|解釋)|(?:apply|analy[sz]e|assess|compare|create|demonstrate|describe|design|develop|discuss|evaluate|examine|explain|identify|interpret|recognize|understand|use|write)\b)/iu;
const administrative = /^(?:詳(?:見|參|閱)?\s*(?:見|附件|檔案|(?:教學|課程)?大?綱)|請(?:先|參|詳|見|隨時|查|至)|歡迎(?:同學|大家)|(?:加退選|退選|選課)須知|教室|課程代碼|學分數|授課教師|上課(?:時間|地點)|(?:考試|成績|作業|評量)(?:方式|規定|占|：|:)|先修|先備|(?:course keywords?|lecture[ -]*\d+|week\s*\d+|(?:please )?(?:see|refer to) (?:the |attached|course |https?)|office hours|please (?:check|refer)|prerequisites?)\b)|^(?:(?:必須|應|須|學生(?:應|須|將))\s*(?:出席|點名|繳交|提交|完成(?:作業|測驗|考試))|students? (?:must|will|should) (?:attend|submit|hand in|complete (?:the |a )?(?:assignment|quiz|test|exam))\b)/iu;
const outlineLeadIn = /(?:[:：]$|(?:課程目的為使|目標為使)(?:同學|學生|學員)能$|(?:objectives?|goals?)(?: of the (?:course|module))? (?:include|are)$|(?:should|will) be able to$)/iu;
const unavailable = /^(?:【大綱內容抓取失敗】|HTTP\s+[45]\d{2}\b|本課程目前無(?:課程)?(?:介紹|大綱)|ISBN\s*:|\(ISBN\b|The design of the assignments\b)/iu;
const outcomeLeadIn = /^.{0,130}?(?:以下(?:之|的)?(?:課程目標|目標|能力|核心能力|學習成效|學習成果))\s*[:：]\s*(.*)$/u;
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });
const words = new Intl.Segmenter("en", { granularity: "word" });

function cleanText(input: string): string {
  return input
    .replace(/&(?:nbsp|#160|#xA0);/giu, " ")
    .replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&").replace(/&quot;/giu, '"').replace(/&#39;|&apos;/giu, "'")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, "")
    .replace(/<\/?(?:p|li|div|br|h[1-6]|section)\b[^>]*>/giu, "\n")
    .replace(/<\/?[a-z][^>]*>/giu, "")
    .replace(/(?:https?:\/\/|www\.)[^\s<>"，。；！？、]+/giu, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^[\t ]*[-=*–—_]{3,}[\t ]*$/gmu, "")
    .replace(/^\s*n[\t ]*\n/u, "")
    .replace(/^[\t ]*R\d{2};/gmu, "•").replace(/R\d{2};/gu, " ")
    .replace(/\p{Co}/gu, "•");
}

function collectText(input: string, goals: boolean): string[] {
  const raw = cleanText(input ?? "");
  const syllabus = /^\s*(?:Course keywords?\s*:|Syllabus for\b|(?:Week|Lecture)[ -]*\d+\b)/imu.test(raw);
  const normalized = raw.replace(/^\s*Course keywords?\s*:[^\n]*/iu, (line) => {
    const start = line.search(inlineHeading);
    return start < 0 ? "" : line.slice(start).trim();
  });
  const buckets: Record<"topic" | "outcome" | "other" | "opening", string[]> = {
    topic: [], outcome: [], other: [], opening: [],
  };
  let section: keyof typeof buckets = "opening";
  let hasTopicHeading = false;
  let hasOutcomeHeading = false;
  let hasOtherHeading = false;
  for (const line of normalized.split("\n")) {
    const headingText = line.trim().replace(/^[【\[]([^】\]]+)[】\]]\s*/u, "$1: ");
    const match = heading.exec(headingText);
    if (match?.groups) {
      section = match.groups.outcome ? "outcome" : match.groups.topic ? "topic" : "other";
      hasTopicHeading ||= section === "topic";
      hasOutcomeHeading ||= section === "outcome";
      hasOtherHeading ||= section === "other";
      if (match.groups.content) buckets[section].push(match.groups.content);
    } else {
      const leadIn = goals && section !== "other" && outcomeLeadIn.exec(line.trim());
      if (leadIn) {
        section = "outcome";
        hasOutcomeHeading = true;
        if (leadIn[1]) buckets.outcome.push(leadIn[1]);
      } else {
        buckets[section].push(line);
      }
    }
  }
  if (!goals) return splitPoints(hasTopicHeading ? buckets.topic : buckets.opening, false, syllabus);
  if (hasOutcomeHeading && buckets.outcome.some((line) => line.trim())) return splitPoints(buckets.outcome, true, syllabus);
  const candidates = splitPoints([...buckets.opening, "", ...buckets.topic], true, syllabus);
  return syllabus || hasTopicHeading || hasOtherHeading ? candidates.filter((point) => outcome.test(point)) : candidates;
}

function splitPoints(lines: string[], goals: boolean, syllabus: boolean): string[] {
  const markup = lines.join("\n");
  const list = goals && [...markup.matchAll(itemNumber)].length > 1
    ? markup.replace(itemNumber, (marker) => `\n${marker.replace(/\s/gu, "")}`)
    : markup;
  const blocks: string[] = [];
  let current = "";
  for (const source of list.split("\n")) {
    const line = source.trim().replace(/^(?:#{1,6}|>)\s*/u, "");
    const item = line.replace(numberedItem, "");
    const hanWrap = syllabus && current.length >= 38 && /\p{Script=Han}$/u.test(current) && /^\p{Script=Han}/u.test(item);
    if (!line || item !== line || (goals && !hanWrap && (imperative.test(item) || outcome.test(item))) || administrative.test(item)) {
      if (current) blocks.push(current);
      current = "";
    }
    if (!item) continue;
    const space = current && !(/\p{Script=Han}$/u.test(current) && /^\p{Script=Han}/u.test(item)) ? " " : "";
    current += `${space}${item}`;
  }
  if (current) blocks.push(current);
  return blocks.flatMap((block) => {
    const parts: string[] = [];
    for (const { segment } of sentences.segment(block)) {
      const previous = parts.at(-1);
      if (previous && /(?:^|\s)\p{Lu}\.\s*$/u.test(previous)) parts[parts.length - 1] = previous + segment;
      else parts.push(segment);
    }
    return parts;
  })
    .flatMap((sentence) => sentence.split(/；|;(?=\s|\p{Script=Han}|$)/u))
    .map((point) => point.replace(/\s+/gu, " ").trim().replace(numberedItem, "")
      .replace(/^[\[（(]\s*(?=請|詳|先修)/u, "").replace(/^[,，、;)）]+\s*/u, "")
      .replace(/[,，]\s*(?:(?:and|or)\s*)?$/iu, ""))
    .filter((point) => /\p{L}{2}/u.test(point) && !administrative.test(point) && !outlineLeadIn.test(point) && !unavailable.test(point));
}

function shorten(point: string): string {
  const limit = 135;
  const characters = Array.from(point);
  if (characters.length <= limit) return point;
  const prefix = characters.slice(0, limit - 1).join("");
  const boundaries = [...prefix.matchAll(/[,，；;](?=\s|\p{Script=Han})/gu)];
  const boundary = boundaries.at(-1)?.index;
  if (boundary && boundary >= limit / 2) return point.slice(0, boundary).trim();
  let end = 0;
  for (const { segment, index, isWordLike } of words.segment(point)) {
    if (index + segment.length > prefix.length) break;
    if (isWordLike) end = index + segment.length;
  }
  return `${end ? point.slice(0, end) : prefix}…`;
}

function selectPoints(points: string[], goals: boolean): string[] {
  const seen = new Set<string>();
  return points.map((point, index) => ({
    point: shorten(point),
    index,
    priority: goals ? Number(imperative.test(point) || outcome.test(point)) : Number(topical.test(point)),
  })).sort((a, b) => b.priority - a.priority || a.index - b.index)
    .filter(({ point }) => {
      const key = point.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map(({ point }) => point);
}

export function summarizeCourseText(description: string, objectives: string): { descriptionPoints: string[]; objectivePoints: string[] } {
  return {
    descriptionPoints: selectPoints(collectText(description, false), false),
    objectivePoints: selectPoints(collectText(objectives, true), true),
  };
}
