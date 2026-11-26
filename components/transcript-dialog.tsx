"use client";

import { ArrowLeft, FileText, History, LoaderCircle, ScanLine, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  assignTranscriptSemester, confirmedTranscriptRows, editSemesterGrade, groupTranscriptForReview, semesterLabels,
  type Semester, type TranscriptHistory, type TranscriptReviewRow, type TranscriptRow,
} from "../lib/transcript-review";

const sampleRows: TranscriptRow[] = [
  { id: "sample-1", term: "114-1", courseCode: "306005001", courseName: "計算機概論", credits: 3, gradeRaw: "87", confidence: .98 },
  { id: "sample-2", term: "114-2", courseCode: "306005001", courseName: "計算機概論", credits: 3, gradeRaw: "90", confidence: .96 },
  { id: "sample-3", term: "114-2", courseCode: "306009001", courseName: "系統分析與設計", credits: 3, gradeRaw: "91", confidence: .97 },
  { id: "sample-4", term: "114-1", courseCode: "302018001", courseName: "銀行經營管理", credits: 3, gradeRaw: "84", confidence: .94 },
  { id: "sample-5", term: "114-2", courseCode: "302032011", courseName: "金融法規", credits: 3, gradeRaw: "W", confidence: .95 },
];

type Draft = { fileName: string; fileType: string; courses: TranscriptReviewRow[]; warnings: string[]; originalUrl?: string };

function SemesterField({ row, semester, position, update }: {
  row: TranscriptReviewRow; semester: Semester; position: number; update: (row: TranscriptReviewRow) => void;
}) {
  const grade = row.semesters[semester];
  const label = semesterLabels[semester];
  return <>
    <span className="transcript-mobile-label" aria-hidden="true">{label}成績</span>
    <input aria-label={`第 ${position} 列${label}成績`} placeholder={grade?.requiresOcrReview ? "待核對" : "—"} maxLength={20} value={grade?.gradeRaw ?? ""}
      onChange={(event) => update(editSemesterGrade(row, semester, { gradeRaw: event.target.value }))} />
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
            if (candidate) update(editSemesterGrade({ ...row, courseName: candidate.title }, semester, {
              courseCode: candidate.code, confidence: candidate.confidence,
            }));
          }}>
          <option value="">選擇比對課程</option>
          {grade.candidates.map(({ code, title, department }) => <option key={code} value={code}>{title}・{department}・{code}</option>)}
        </select>
      </label>}
    </details>
  </>;
}

export function TranscriptDialog({ displayName, close }: { displayName: string; close: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [earliestYear, setEarliestYear] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<TranscriptHistory[]>([]);
  const [historyStatus, setHistoryStatus] = useState("正在讀取紀錄…");
  const originalUrl = draft?.originalUrl;
  const pendingYears = draft?.courses.filter((row) => !row.year).length ?? 0;
  const pendingNames = draft?.courses.filter((row) => !row.courseName.trim()
    && (row.unassigned || Object.keys(row.semesters).length > 0)).length ?? 0;

  useEffect(() => {
    if (originalUrl) return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/transcripts", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { transcripts } = await response.json() as { transcripts: TranscriptHistory[] };
      if (!controller.signal.aborted) {
        setHistory(transcripts);
        setHistoryStatus(transcripts.length ? "" : "尚無成績單紀錄。");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryStatus("目前無法讀取先前的紀錄。");
    });
    return () => controller.abort();
  }, []);

  function startReview(rows: TranscriptRow[], fileName: string, fileType: string, source?: File, warnings: string[] = []) {
    setDraft({ fileName, fileType, courses: groupTranscriptForReview(rows), warnings, originalUrl: source && URL.createObjectURL(source) });
    setStatus(rows.length ? "" : "這份檔案沒有辨識出科目，可以手動新增。");
  }

  function editCourses(edit: (courses: TranscriptReviewRow[]) => TranscriptReviewRow[]) {
    setDraft((value) => value && { ...value, courses: edit(value.courses) });
    setStatus("");
  }

  async function runOcr() {
    if (!file || processing) return;
    setProcessing(true);
    setStatus("正在辨識科目和學期成績…");
    try {
      const { scanTranscript } = await import("../lib/transcript-scan-client");
      const { rows, warnings } = await scanTranscript(file, earliestYear.trim(), setStatus);
      startReview(rows, file.name, file.type, file, warnings);
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
        body: JSON.stringify({ fileName: draft.fileName, fileType: draft.fileType, rows: validated.rows }),
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
          <h2 id="transcript-review-title"><ScanLine size={22} />{draft ? "核對科目與學期成績" : "上傳政大成績單"}</h2>
          <p>{draft ? "可修改學年度、科目名稱和分數。未修或未辨識到的成績可留空。" : `${displayName}，選擇一份成績單開始辨識。`}</p>
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
          {originalUrl && pendingYears > 0 && <p className="transcript-year-notice" role="status">有 {pendingYears} 列的學年度待核對，請依原檔補填。</p>}
          {originalUrl && pendingNames > 0 && <p className="transcript-year-notice" role="status">有 {pendingNames} 列的課名待核對，該列讀到的成績與學分已保留。</p>}
          {draft.warnings.map((warning) => <p key={warning} className="transcript-year-notice">{warning}</p>)}
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
                      onChange={(event) => update({ ...row, courseName: event.target.value })} />
                  </td>
                  <td><SemesterField row={row} semester="1" position={position} update={update} /></td>
                  <td><SemesterField row={row} semester="2" position={position} update={update} /></td>
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
                    </label> : row.semesters["3"] && <SemesterField row={row} semester="3" position={position} update={update} />}
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
            <label className="transcript-earliest-year">最早學年度（選填）
              <input inputMode="numeric" maxLength={4} placeholder="例如 110" value={earliestYear} disabled={processing}
                onChange={(event) => { setEarliestYear(event.target.value); setStatus(""); }} />
            </label>
          </div>
          <label className="secondary-action">選擇檔案<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden disabled={processing}
            onChange={(event) => {
              if (file) setEarliestYear("");
              setFile(event.target.files?.[0] ?? null);
              setStatus("");
            }} /></label>
          <button className="primary-action compact" onClick={runOcr} disabled={!file || processing}>
            {processing ? <LoaderCircle className="animate-spin" size={16} /> : <ScanLine size={16} />}開始 OCR
          </button>
        </section>
        <div className="transcript-toolbar">
          <p role="status">{status}</p>
          <button disabled={processing} onClick={() => startReview(sampleRows, "範例成績單", "sample")}>載入範例測試</button>
        </div>
        <section className="transcript-history mb-6">
          <div className="transcript-history-heading"><h3><History size={17} />過去成績單</h3><span>{history.length} 份</span></div>
          {historyStatus ? <p className="history-empty">{historyStatus}</p> : <div className="history-card-list">{history.map((entry) => <div key={entry.id} className="history-card">
            <span className="history-card-icon"><FileText size={17} /></span>
            <span className="min-w-0 flex-1">
              <strong>{entry.fileName}</strong><small>{entry.rows.length} 筆學期成績</small>
              <span className="transcript-history-actions">
                <a href={`/transcripts/${encodeURIComponent(entry.id)}`}>查看結果</a>
                <button disabled={processing} onClick={() => startReview(entry.rows, entry.fileName, entry.fileType)}>載入核對</button>
              </span>
            </span>
          </div>)}</div>}
        </section>
      </>}
    </div>
  </div>;
}
