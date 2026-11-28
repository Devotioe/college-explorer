"use client";

import { ArrowLeft, Check, FileText, History, LoaderCircle, ScanLine, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { nccuRequirementTableUrl } from "../lib/curricula";
import { classifyNccuCourse, nccuDepartments } from "../lib/nccu-study-profile";
import {
  assignTranscriptSemester, confirmedTranscriptRows, editSemesterGrade, groupTranscriptForReview, semesterLabels, transcriptCreditCheck, transcriptFileNameLimit,
  type Semester, type TranscriptHistory, type TranscriptLibrary, type TranscriptReviewRow, type TranscriptRow, type TranscriptSemesterSummary,
} from "../lib/transcript-review";

type Draft = { fileName: string; fileType: string; courses: TranscriptReviewRow[]; warnings: string[]; originalUrl?: string;
  homeDepartment: string; admissionYear: string; summaries: TranscriptSemesterSummary[] };

function SemesterSummaryTable({ draft }: { draft: Draft }) {
  const entries = draft.summaries.map((summary) => ({ ...summary, check: transcriptCreditCheck(draft.courses, summary) }));
  const mismatches = entries.filter(({ check }) => check && !check.matches).length;
  return <details className="transcript-summary">
    <summary>學期統計與學分核對{mismatches > 0 && <span>（{mismatches} 個學期待核對）</span>}</summary>
    <div className="transcript-table-wrap">
      <table className="transcript-table">
        <thead><tr><th scope="col">學期</th><th scope="col">平均成績</th><th scope="col">修習學分</th>
          <th scope="col">實得學分</th><th scope="col">累計學分</th><th scope="col">明細核對</th></tr></thead>
        <tbody>{entries.map(({ term, average, attemptedCredits, earnedCredits, cumulativeCredits, check }) =>
          <tr key={term}><th scope="row">{term}</th><td>{average ?? "—"}</td><td>{attemptedCredits ?? "—"}</td>
            <td>{earnedCredits ?? "—"}</td><td>{cumulativeCredits ?? "—"}</td>
            <td>{!check ? "資料不足" : check.matches ? "學分相符" : `明細加總 ${check.listed}，請對照原檔`}</td></tr>)}</tbody>
      </table>
    </div>
  </details>;
}

function SemesterField({ row, semester, position, homeDepartment, update }: {
  row: TranscriptReviewRow; semester: Semester; position: number; homeDepartment: string; update: (row: TranscriptReviewRow) => void;
}) {
  const grade = row.semesters[semester];
  const label = semesterLabels[semester];
  const own = ({ code, department, confidence }: { code: string; department: string; confidence: number }) => homeDepartment
    && confidence >= .9 && classifyNccuCourse({ code, unit: department })?.department === homeDepartment;
  const suggestions = [...(grade?.candidates ?? [])].sort((a, b) => Number(Boolean(own(b))) - Number(Boolean(own(a))));
  return <>
    <span className="transcript-mobile-label" aria-hidden="true">{label}成績</span>
    <input aria-label={`第 ${position} 列${label}成績`} placeholder={grade?.requiresOcrReview ? "待核對" : "—"} maxLength={20} value={grade?.gradeRaw ?? ""}
      onChange={(event) => update(editSemesterGrade(row, semester, { gradeRaw: event.target.value }))} />
    {grade?.requiresOcrReview && grade.gradeRaw && <small className="transcript-term-warning">待核對</small>}
    <details className="transcript-grade-details">
      <summary>{label}課號與學分</summary>
      <label>課號
        <input aria-label={`第 ${position} 列${label}課號`} placeholder="可留空" maxLength={40} value={grade?.courseCode ?? ""}
          onChange={(event) => update(editSemesterGrade(row, semester, { courseCode: event.target.value }))} />
      </label>
      <label>學分
        <input aria-label={`第 ${position} 列${label}學分`} type="number" min="0" max="20" step="0.5" value={grade?.credits ?? ""}
          onChange={(event) => update(editSemesterGrade(row, semester, {
            credits: event.target.value === "" ? null : event.target.valueAsNumber,
          }))} />
      </label>
      {!!grade?.candidates?.length && <label>課程建議
        <select aria-label={`第 ${position} 列${label}課程建議`} value={grade.candidates.some(({ code }) => code === grade.courseCode) ? grade.courseCode : ""}
          onChange={(event) => {
            const candidate = grade.candidates?.find(({ code }) => code === event.target.value);
            if (candidate) update(editSemesterGrade({ ...row, courseName: candidate.title, requiresTitleReview: undefined }, semester, {
              courseCode: candidate.code, confidence: candidate.confidence,
            }));
          }}>
          <option value="">選擇比對課程</option>
          {suggestions.map((candidate) => <option key={candidate.code} value={candidate.code}>
            {candidate.title}・{candidate.department}・{candidate.code}{own(candidate) ? "（本科系）" : ""}
          </option>)}
        </select>
      </label>}
    </details>
  </>;
}

type HistoryEdit = { kind: "rename"; id: string; fileName: string } | { kind: "delete"; id: string };

export function TranscriptDialog({ displayName, close, library, libraryError, onLibraryChange }: {
  displayName: string; close: () => void; library?: TranscriptLibrary; libraryError?: string;
  onLibraryChange: (library: TranscriptLibrary) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadDepartment, setUploadDepartment] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [historyEdit, setHistoryEdit] = useState<HistoryEdit | null>(null);
  const [historyMessage, setHistoryMessage] = useState("");
  const history = library?.transcripts ?? [];
  const activeId = library?.activeTranscript?.id;
  const historyStatus = libraryError ?? (!library ? "正在讀取紀錄…" : history.length ? "" : "尚無成績單紀錄。");
  const originalUrl = draft?.originalUrl;
  const pendingYears = draft?.courses.filter((row) => !row.year).length ?? 0;
  const pendingNames = draft?.courses.filter((row) => !row.courseName.trim()
    && (row.unassigned || Object.keys(row.semesters).length > 0)).length ?? 0;

  useEffect(() => {
    if (originalUrl) return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  function startReview(rows: TranscriptRow[], fileName: string, fileType: string, {
    source, warnings = [], summaries = [], homeDepartment = "", admissionYear = "",
  }: Partial<Pick<Draft, "warnings" | "summaries" | "homeDepartment" | "admissionYear">> & { source?: File } = {}) {
    setDraft({ fileName, fileType, courses: groupTranscriptForReview(rows), warnings, summaries, homeDepartment, admissionYear,
      originalUrl: source && URL.createObjectURL(source) });
    setStatus("");
  }

  function editCourses(edit: (courses: TranscriptReviewRow[]) => TranscriptReviewRow[]) {
    setDraft((value) => value && { ...value, courses: edit(value.courses) });
    setStatus("");
  }

  async function reviewHistory(id: string) {
    setProcessing(true);
    setHistoryMessage("正在讀取成績單…");
    try {
      const response = await fetch(`/api/transcripts/${encodeURIComponent(id)}`);
      const data = await response.json() as { transcript?: TranscriptHistory; error?: string };
      if (!response.ok || !data.transcript) throw new Error(data.error ?? "無法讀取成績單。");
      const { rows, fileName, fileType, homeDepartment, admissionYear } = data.transcript;
      setHistoryMessage("");
      startReview(rows, fileName, fileType, { homeDepartment: homeDepartment ?? "", admissionYear: admissionYear ?? "" });
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "無法讀取成績單。");
    } finally {
      setProcessing(false);
    }
  }

  async function updateHistory(id: string, body?: { fileName: string } | { active: true }) {
    setProcessing(true);
    setHistoryMessage("");
    try {
      const response = await fetch(`/api/transcripts/${encodeURIComponent(id)}`, body
        ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : { method: "DELETE" });
      const data = await response.json() as TranscriptLibrary & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "無法更新成績單，請稍後再試。");
      onLibraryChange(data);
      setHistoryEdit(null);
      setHistoryMessage(body ? ("active" in body ? "已切換分析來源。" : "已更新成績單檔名。") : "已刪除成績單。");
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "無法更新成績單，請稍後再試。");
    } finally {
      setProcessing(false);
    }
  }

  async function runOcr() {
    if (!file || processing) return;
    setProcessing(true);
    setStatus("正在辨識科目和學期成績…");
    try {
      const { scanTranscript } = await import("../lib/transcript-scan-client");
      const { rows, warnings, summaries } = await scanTranscript(file, setStatus);
      startReview(rows, file.name, file.type, { source: file, warnings, summaries, homeDepartment: uploadDepartment });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "成績單辨識失敗");
    } finally {
      setProcessing(false);
    }
  }

  async function saveRows(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || processing) return;
    const validated = confirmedTranscriptRows(draft.courses);
    if ("error" in validated) {
      setStatus(validated.error);
      return;
    }
    setProcessing(true);
    setStatus("正在保存成績並產生結果…");
    try {
      const response = await fetch("/api/transcripts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: draft.fileName, fileType: draft.fileType, rows: validated.rows,
          homeDepartment: draft.homeDepartment, admissionYear: draft.admissionYear.trim() }),
      });
      const data = await response.json() as { transcript?: { id: string }; error?: string };
      if (!response.ok || !data.transcript?.id) throw new Error(data.error ?? "保存失敗");
      window.location.assign(`/transcripts/${encodeURIComponent(data.transcript.id)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失敗");
      setProcessing(false);
    }
  }

  function closeWhenIdle() {
    if (!processing) close();
  }

  return <div className="modal-backdrop transcript-backdrop" onMouseDown={closeWhenIdle}>
    <div className="transcript-dialog" role="dialog" aria-modal="true" aria-labelledby="transcript-review-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="transcript-header">
        <div>
          <h2 id="transcript-review-title"><ScanLine size={22} />{draft ? "核對科目與學期成績" : "管理政大成績單"}</h2>
          <p>{draft ? `來源：${draft.fileName}。請核對學年度、科目與成績。` : `${displayName}，選擇一份成績單開始辨識。`}</p>
        </div>
        <button type="button" className="modal-close static" aria-label="關閉" onClick={closeWhenIdle} disabled={processing}><X size={17} /></button>
      </header>

      {draft ? <form onSubmit={saveRows}>
        <fieldset disabled={processing}>
          <div className="transcript-review-actions">
            <button type="button" className="secondary-action" onClick={() => { setDraft(null); setStatus(""); }}><ArrowLeft size={15} />返回上傳</button>
            {originalUrl && <a className="secondary-action" href={originalUrl} target="_blank" rel="noreferrer">
              <FileText size={15} aria-hidden="true" />開啟原檔對照
            </a>}
            <button type="button" className="secondary-action" onClick={() => editCourses((courses) => [
              ...courses, { id: crypto.randomUUID(), year: courses.at(-1)?.year ?? "", courseName: "", semesters: {} },
            ])}>新增科目</button>
          </div>
          <div className="transcript-review-actions">
            <label className="transcript-context-field">本科系
              <select value={draft.homeDepartment} onChange={(event) => {
                const homeDepartment = event.target.value;
                setDraft({ ...draft, homeDepartment });
              }}>
                <option value="">請確認或選擇系所</option>
                {nccuDepartments.map((department) => <option key={department}>{department}</option>)}
              </select>
            </label>
            <label className="transcript-context-field">入學學年度（選填）
              <input inputMode="numeric" maxLength={4} placeholder="例如 110" value={draft.admissionYear}
                onChange={(event) => setDraft({ ...draft, admissionYear: event.target.value })} />
            </label>
            <a className="secondary-action" href={nccuRequirementTableUrl(draft.admissionYear)} target="_blank" rel="noreferrer">政大必修科目表</a>
          </div>
          {originalUrl && pendingYears > 0 && <p className="transcript-year-notice" role="status">有 {pendingYears} 列的學年度待核對，請依原檔補填。</p>}
          {originalUrl && pendingNames > 0 && <p className="transcript-year-notice" role="status">有 {pendingNames} 列的課名待核對，該列讀到的成績與學分已保留。</p>}
          {draft.warnings.map((warning) => <p key={warning} className="transcript-year-notice">{warning}</p>)}
          {!!draft.summaries.length && <SemesterSummaryTable draft={draft} />}
          <div className="transcript-table-wrap">
            <table className="transcript-table transcript-review-table">
              <thead><tr>
                <th scope="col">學年度</th><th scope="col">科目</th><th scope="col">上學期成績</th><th scope="col">下學期成績</th>
                <th scope="col">其他學期</th><th scope="col">移除</th>
              </tr></thead>
              <tbody>{draft.courses.map((row, index) => {
                const position = index + 1;
                const update = (next: TranscriptReviewRow) => editCourses((courses) => courses.map((item) => item.id === row.id ? next : item));
                return <tr key={row.id}>
                  <td className="transcript-review-year">
                    <span className="transcript-mobile-label" aria-hidden="true">學年度</span>
                    <input aria-label={`第 ${position} 列學年度`} inputMode="numeric" maxLength={4} placeholder="待核對" value={row.year}
                      onChange={(event) => update({ ...row, year: event.target.value })} />
                  </td>
                  <td className="transcript-review-name">
                    <span className="transcript-mobile-label" aria-hidden="true">科目</span>
                    <input aria-label={`第 ${position} 列科目`} maxLength={160} placeholder={originalUrl ? "課名待核對" : "科目名稱"} value={row.courseName}
                      onChange={(event) => update({ ...row, courseName: event.target.value, requiresTitleReview: undefined })} />
                    {row.ocrCourseName ? <small className="transcript-term-warning">
                      {row.requiresTitleReview && "課程庫配對，請核對。"}OCR 原文「{row.ocrCourseName}」
                    </small> : row.requiresTitleReview && row.courseName && <small className="transcript-term-warning">課名待核對</small>}
                  </td>
                  <td><SemesterField row={row} semester="1" position={position} homeDepartment={draft.homeDepartment} update={update} /></td>
                  <td><SemesterField row={row} semester="2" position={position} homeDepartment={draft.homeDepartment} update={update} /></td>
                  <td className="transcript-review-other">
                    {row.unassigned ? <label className="transcript-term-warning">
                      未判定學期・{row.unassigned.gradeRaw || "成績空白"}
                      <select aria-label={`第 ${position} 列指定學期`} value="" onChange={(event) => {
                        const semester = event.target.value as Semester;
                        if (semester) update(assignTranscriptSemester(row, semester));
                      }}>
                        <option value="">請指定學期</option>
                        {(["1", "2", "3"] as const).map((term) => <option key={term} value={term}>{semesterLabels[term]}</option>)}
                      </select>
                    </label> : row.semesters["3"] && <SemesterField row={row} semester="3" position={position} homeDepartment={draft.homeDepartment} update={update} />}
                  </td>
                  <td className="transcript-review-remove">
                    <button type="button" aria-label={`移除第 ${position} 列`} className="mini-action danger"
                      onClick={() => editCourses((courses) => courses.filter(({ id }) => id !== row.id))}><Trash2 size={15} /></button>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </fieldset>
        <footer className="transcript-footer">
          <div>
            <p><ShieldCheck size={14} />系統以你確認的成績計算修課分布。</p>
            {status && <p className="transcript-status" role="status">{status}</p>}
          </div>
          <button type="submit" className="primary-action compact" disabled={processing || !draft.courses.length}>
            {processing && <LoaderCircle size={16} className="animate-spin" />}確認並查看吉祥物
          </button>
        </footer>
      </form> : <>
        <section className="upload-panel">
          <div className="upload-icon"><UploadCloud size={24} /></div>
          <div className="min-w-0 flex-1">
            <h3>{file?.name ?? "選擇成績單檔案"}</h3>
            <p>支援 PDF、JPG、PNG、WebP，最大 10 MB。</p>
            <p>可以裁掉個資欄，請保留學年度、學期表頭和課程欄。</p>
            <label className="transcript-context-field">政大系所
              <select value={uploadDepartment} disabled={processing} onChange={(event) => {
                setUploadDepartment(event.target.value);
                setStatus("");
              }}>
                <option value="">請選擇本科系</option>
                {nccuDepartments.map((department) => <option key={department}>{department}</option>)}
              </select>
            </label>
          </div>
          <label className="secondary-action">選擇檔案<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={processing}
            onChange={(event) => {
              if (file) setUploadDepartment("");
              setFile(event.target.files?.[0] ?? null);
              setStatus("");
            }} /></label>
          <button className="primary-action compact" onClick={runOcr} disabled={!file || processing}>
            {processing ? <LoaderCircle className="animate-spin" size={16} /> : <ScanLine size={16} />}開始 OCR
          </button>
        </section>
        {status && <div className="transcript-toolbar">
          <p role="status">{status}</p>
        </div>}
        <section className="transcript-history mb-6">
          <div className="transcript-history-heading"><h3><History size={17} />過去成績單</h3><span>{history.length} 份</span></div>
          {historyMessage && <p className="history-empty" role="status">{historyMessage}</p>}
          {historyStatus ? <p className="history-empty">{historyStatus}</p> : <div className="history-card-list">{history.map((entry) => {
            const active = entry.id === activeId;
            const sample = entry.fileType === "sample";
            const edit = historyEdit?.id === entry.id ? historyEdit : null;
            return <div key={entry.id} className="history-card" data-active={active}>
              <span className="history-card-icon" aria-hidden="true">{active ? <Check size={17} /> : <FileText size={17} />}</span>
              <div className="min-w-0 flex-1">
                <strong title={entry.fileName}>{entry.fileName}</strong>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{entry.rowCount} 筆學期成績</span>
                  {sample && <span>範例資料</span>}
                  {active && <span className="transcript-source-badge">使用中</span>}
                </div>
                {edit?.kind === "rename" ? <form className="transcript-history-edit" onSubmit={(event) => {
                  event.preventDefault();
                  if (edit.fileName.trim() && !processing) void updateHistory(entry.id, { fileName: edit.fileName });
                }}>
                  <input aria-label="新的成績單檔名" autoFocus maxLength={transcriptFileNameLimit} required disabled={processing} value={edit.fileName}
                    onChange={(event) => setHistoryEdit({ ...edit, fileName: event.target.value })} />
                  <div className="transcript-history-actions">
                    <button type="submit" disabled={processing || !edit.fileName.trim()}>儲存名稱</button>
                    <button type="button" disabled={processing} onClick={() => setHistoryEdit(null)}>取消</button>
                  </div>
                </form> : edit?.kind === "delete" ? <div className="transcript-history-edit">
                  <p>刪除「{entry.fileName}」及已儲存的成績？</p>
                  <div className="transcript-history-actions">
                    <button type="button" className="transcript-delete" disabled={processing} onClick={() => void updateHistory(entry.id)}>確認刪除</button>
                    <button type="button" disabled={processing} onClick={() => setHistoryEdit(null)}>取消</button>
                  </div>
                </div> : <div className="transcript-history-actions">
                  {!active && !sample && <button type="button" className="transcript-use" disabled={processing} onClick={() => void updateHistory(entry.id, { active: true })}>用這份分析</button>}
                  {!sample && <a href={`/transcripts/${encodeURIComponent(entry.id)}`}>查看結果</a>}
                  {!sample && <button type="button" disabled={processing} onClick={() => void reviewHistory(entry.id)}>載入核對</button>}
                  <button type="button" disabled={processing} onClick={() => setHistoryEdit({ kind: "rename", id: entry.id, fileName: entry.fileName })}>重新命名</button>
                  <button type="button" className="transcript-delete" disabled={processing} onClick={() => setHistoryEdit({ kind: "delete", id: entry.id })}>刪除</button>
                </div>}
              </div>
            </div>;
          })}</div>}
        </section>
      </>}
    </div>
  </div>;
}
