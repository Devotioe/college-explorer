import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCourseText } from "../lib/course-highlights.ts";

test("returns at most three clean distinct points in the source language", () => {
  const description = "<p>本課程探討流域治理與環境正義。</p>\n<p>本課程探討流域治理與環境正義。</p>\n1. 分析用水政策。\n2. 設計公民參與方案。\n3. 認識地方文化。\nhttps://example.com/course";
  const { descriptionPoints, objectivePoints } = summarizeCourseText(description, "");
  assert.equal(descriptionPoints.length, 3);
  assert.equal(new Set(descriptionPoints).size, 3);
  assert.ok(descriptionPoints.some((point) => point.includes("流域治理與環境正義")));
  assert.ok(descriptionPoints.every((point) => !/<|https?:|^\d+\./.test(point)));
  assert.deepEqual(objectivePoints, []);
});

test("keeps individual learning outcomes from English and Chinese numbered lists", () => {
  const english = summarizeCourseText("", "Apply research methods to interviews.\nDiscuss evidence in English.\nWrite a field report.\nExplain basic ethics.");
  assert.deepEqual(english.objectivePoints, ["Apply research methods to interviews.", "Discuss evidence in English.", "Write a field report."]);
  const chinese = summarizeCourseText("", "1.\n辨識新聞來源\n2.\n比較採訪方法\n3.\n以證據支持論點");
  assert.deepEqual(chinese.objectivePoints, ["辨識新聞來源", "比較採訪方法", "以證據支持論點"]);
});

test("extracts the learning-outcome section and stops before syllabus logistics", () => {
  const syllabus = "Course keywords: Experimental design      (I) Course Description\rStudents study environmental systems.\r\r(II) Expected Learning Outcomes\r1. Students will design a controlled experiment.\r2. Students will interpret uncertainty in measurements.\r\r(III) Assessment\rStudents will complete a final quiz.\r(IV) Schedule\rWeek 1: Lab safety.";
  const { objectivePoints } = summarizeCourseText("Environmental systems.", syllabus);
  assert.deepEqual(objectivePoints, ["Students will design a controlled experiment.", "Students will interpret uncertainty in measurements."]);
});

test("finds sentence-based outcomes in syllabi without treating schedules and rules as outcomes", () => {
  const syllabus = "Course keywords: 環境治理      一、課程說明（Course Description）\r本課程以頭前溪為例，培養學生問題分\r析與利害關係人溝通能力。\r學生將運用設計思考提出方案。\r二、成績考核：學生將完成考試與期末報告。";
  const { objectivePoints } = summarizeCourseText("", syllabus);
  assert.deepEqual(objectivePoints, ["本課程以頭前溪為例，培養學生問題分析與利害關係人溝通能力。", "學生將運用設計思考提出方案。"]);
  const rulesOnly = "Course keywords: Graphs    先修科目：學生須先修微積分。\r一、課程說明：本課程包含理論課與助教課。\r二、成績考核：鼓勵學生培養答題能力，須交三份作業。\rWeek 7: Midterm";
  assert.deepEqual(summarizeCourseText("", rulesOnly).objectivePoints, []);
});

test("favors course subjects over generic and administrative description text", () => {
  const description = "請先閱讀選課須知。教室資訊請見公告。歡迎同學一起修課。課程涵蓋分子軌域與群論。認識有機金屬鍵結。探討固態化學中的晶體結構。";
  const { descriptionPoints } = summarizeCourseText(description, "");
  assert.deepEqual(descriptionPoints, ["課程涵蓋分子軌域與群論。", "認識有機金屬鍵結。", "探討固態化學中的晶體結構。"]);
});

test("keeps complete sentences when a description exceeds the point limit", () => {
  const description = "This course introduces measurement and uncertainty in physical experiments, addresses the practical constraints that students encounter when planning a study with limited time and incomplete access to equipment, and walks learners through different setups. Students compare two methods for calibrating a sensor.";
  const { descriptionPoints } = summarizeCourseText(description, "");
  assert.ok(descriptionPoints.some((point) => point.includes("measurement and uncertainty")));
  assert.ok(descriptionPoints.includes("Students compare two methods for calibrating a sensor."));
  assert.ok(descriptionPoints.every((point) => point.length <= 180));
});

test("ignores decorative syllabus dividers around learning goals", () => {
  const objectives = "Course objectives\n************\n1. Identify common sources of bias.\n------------\n2. Evaluate research evidence.";
  assert.deepEqual(summarizeCourseText("", objectives).objectivePoints, ["Identify common sources of bias.", "Evaluate research evidence."]);
});

test("drops outline introductions and separates outcomes without final punctuation", () => {
  const objectives = "本課程希望達成以下目標：\n（\n1\n）辨識媒體來源；（2）比較兩種訪談方式；（3）以證據支持論點。";
  assert.deepEqual(summarizeCourseText("", objectives).objectivePoints, ["辨識媒體來源", "比較兩種訪談方式", "以證據支持論點。"]);
  const english = "Students should be able to understand basic linguistic terms.\nStudents should be able to recognize language families\nStudents should be able to identify scripts\nStudents should be able to explain metaphors";
  assert.deepEqual(summarizeCourseText("", english).objectivePoints, ["Students should be able to understand basic linguistic terms.", "Students should be able to recognize language families", "Students should be able to identify scripts"]);
});

test("drops attachment placeholders and cleans corrupted bullet markers", () => {
  const objectives = "R26;認識地方文學\nR26;比較現代小說\n請參閱課綱";
  assert.deepEqual(summarizeCourseText("詳附件", objectives), {
    descriptionPoints: [], objectivePoints: ["認識地方文學", "比較現代小說"],
  });
});

test("bounds unpunctuated Chinese text without splitting graphemes", () => {
  const text = "本課程探討" + "生態研究與跨領域資料分析".repeat(19);
  const { descriptionPoints } = summarizeCourseText(text, "");
  assert.equal(descriptionPoints.length, 1);
  assert.ok(Array.from(descriptionPoints[0]).length <= 140);
  assert.match(descriptionPoints[0], /…$/u);
});

test("ignores official retrieval errors and metadata-only headers", () => {
  const invalid = "【大綱內容抓取失敗】 HTTP 404";
  assert.deepEqual(summarizeCourseText(invalid, invalid), { descriptionPoints: [], objectivePoints: [] });
  assert.deepEqual(summarizeCourseText("", "[課程目標]\n培養資料整理能力。\n[成績計算]\n強化考試作答技巧，每週交作業。").objectivePoints, ["培養資料整理能力。"]);
});

test("joins a PDF line break within a learner outcome", () => {
  const goals = "Course keywords: 河川水資源\n課程說明：\n課程透過課堂講授、跨域討論、專家座談、實地踏查、資料分析與團隊專題等方式，培養學生問題\n分析、利害關係人溝通、跨域整合及方案設計能力。\n成績考核：期末報告。";
  assert.deepEqual(summarizeCourseText("", goals).objectivePoints, ["課程透過課堂講授、跨域討論、專家座談、實地踏查、資料分析與團隊專題等方式，培養學生問題分析、利害關係人溝通、跨域整合及方案設計能力。"]);
});

test("removes English list lead-ins and textbook name fragments", () => {
  const text = "The objectives of the module include (1) describing the major political systems, (2) comparing systems using case studies, and (3) relating theory to recent events.";
  assert.deepEqual(summarizeCourseText("", text).objectivePoints, ["describing the major political systems", "comparing systems using case studies", "relating theory to recent events."]);
  const description = "See the textbook written by R. Shankar. The course explores quantum mechanics and how wave functions model a system.";
  assert.deepEqual(summarizeCourseText(description, "").descriptionPoints, ["The course explores quantum mechanics and how wave functions model a system."]);
});

test("finds an inline numbered objective heading after a keyword banner", () => {
  const objectives = "Course keywords: Experiment; measurement      1. Course objective:\rLaboratory experiments in heat transfer.\r2. Text Books:\rNone.";
  assert.deepEqual(summarizeCourseText("", objectives).objectivePoints, ["Laboratory experiments in heat transfer."]);
});

test("recognizes stated goals and learner skills in a course description section", () => {
  const objectives = "Course keywords: 書報討論      一、課程說明\r課程目標是學習科學論文架構。經由研讀文獻，使學生\r具有閱讀、表達與分析科學文章的能力。\r二、指定用書\r無";
  assert.deepEqual(summarizeCourseText("", objectives).objectivePoints, ["課程目標是學習科學論文架構。", "經由研讀文獻，使學生具有閱讀、表達與分析科學文章的能力。"]);
});
