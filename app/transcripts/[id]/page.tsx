import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, BookOpen, Check, Compass } from "lucide-react";
import { notFound } from "next/navigation";
import courseIndex from "../../../data/nccu-course-index.json";
import { getDb } from "../../../db";
import { transcriptCourseRows, transcriptUploads } from "../../../db/schema";
import { nccuRequirementTableUrl } from "../../../lib/curricula";
import { nccuTranscriptCurriculum, resolveNccuTranscriptCourse } from "../../../lib/nccu-course-match";
import { buildNccuStudyProfile, mascotIconPath } from "../../../lib/nccu-study-profile";
import { getCurrentPasswordUser } from "../../../lib/password-auth";

export const dynamic = "force-dynamic";

const catalog = courseIndex.map(({ code, title, department }) => ({ id: code, school: "NCCU", code, title, unit: department }));

export default async function TranscriptResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentPasswordUser();
  if (!user) return <main className="app-shell min-h-screen p-6">
    <div className="mx-auto max-w-xl rounded-3xl border p-6">
      <h1 className="text-2xl font-bold">登入後查看成績單結果</h1>
      <a className="secondary-action mt-4" href="/">返回 Course Compass</a>
    </div>
  </main>;

  const { id } = await params;
  const db = getDb();
  const [upload] = await db.select({ id: transcriptUploads.id, homeDepartment: transcriptUploads.homeDepartment,
    admissionYear: transcriptUploads.admissionYear }).from(transcriptUploads)
    .where(and(eq(transcriptUploads.id, id), eq(transcriptUploads.userId, user.id), eq(transcriptUploads.status, "confirmed")))
    .limit(1);
  if (!upload) notFound();

  const rows = await db.select({
    term: transcriptCourseRows.term, courseCode: transcriptCourseRows.courseCode,
    courseName: transcriptCourseRows.courseName, gradeRaw: transcriptCourseRows.gradeRaw, credits: transcriptCourseRows.credits,
  }).from(transcriptCourseRows).where(and(eq(transcriptCourseRows.transcriptId, upload.id), eq(transcriptCourseRows.confirmed, true)))
    .orderBy(asc(transcriptCourseRows.term), asc(transcriptCourseRows.courseName));
  const homeDepartment = upload.homeDepartment ?? "";
  const admissionYear = upload.admissionYear ?? "";
  const profile = buildNccuStudyProfile(rows.map((row) => {
    const match = resolveNccuTranscriptCourse(row, homeDepartment, admissionYear);
    return match ? { ...row, courseCode: match.code, assignmentReason: match.reason } : row;
  }), catalog);
  const requirementSource = nccuTranscriptCurriculum(homeDepartment, admissionYear)?.source ?? nccuRequirementTableUrl(admissionYear);
  const { departmentMascot: mascot, departments, courseAssignments } = profile;
  const mappedCount = departments.reduce((total, department) => total + department.count, 0);
  const tied = departments.length > 1 && departments[0].count === departments[1].count;

  return <main className="app-shell min-h-screen px-4 py-6 sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <a className="mb-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4" href="/?view=map">
        <ArrowLeft size={16} />返回學習路徑
      </a>
      <section className="transcript-result-hero" aria-labelledby="transcript-result-title">
        <div className="transcript-result-art">
          {mascot
            ? <img src={mascotIconPath(mascot.symbol, "mascot-results")}
                alt={mascot.label} width={512} height={512} />
            : <Compass size={82} strokeWidth={1.3} aria-hidden="true" />}
        </div>
        <div className="transcript-result-heading">
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Check size={17} />成績單已確認</p>
          {homeDepartment && <p className="text-sm">本科系 {homeDepartment}{admissionYear && `・${admissionYear} 學年度入學`}</p>}
          <h1 id="transcript-result-title">{mascot?.label ?? (tied ? "跨系修課並列" : "你的修課分布")}</h1>
          <p>{mascot ? `${mascot.name}修課最多，共 ${mascot.count} 門。`
            : tied ? "多個系所的修課門數相同。下方是這份成績單的系所分布。"
              : "這份成績單目前沒有足夠的課程資料判定吉祥物。"}</p>
          <dl className="transcript-result-metrics">
            <div><dt>修過的科目</dt><dd>{profile.countedCount} 門</dd></div>
            <div><dt>已配對系所</dt><dd>{mappedCount} 門</dd></div>
            <div><dt>系所待確認</dt><dd>{profile.countedCount - mappedCount} 門</dd></div>
          </dl>
        </div>
      </section>

      <div className="transcript-result-details">
        <section aria-labelledby="result-departments">
          <h2 id="result-departments">系所修課分布</h2>
          {departments.length ? <dl className="transcript-result-list">
            {departments.map(({ name, count }) => <div key={name}><dt>{name}</dt><dd>{count} 門</dd></div>)}
          </dl> : <p className="mt-3 text-sm">目前沒有可配對到系所的科目。</p>}
        </section>
        <section aria-labelledby="result-courses">
          <h2 id="result-courses" className="flex items-center gap-2"><BookOpen size={19} />科目與對應系所</h2>
          {homeDepartment && <a className="mb-2 inline-block text-sm underline" href={requirementSource} target="_blank" rel="noreferrer">查閱校方必修科目表</a>}
          {courseAssignments.length ? <div className="overflow-x-auto">
            <table className="transcript-result-grid">
              <thead><tr><th scope="col">科目</th><th scope="col">開課系所</th></tr></thead>
              <tbody>{courseAssignments.map(({ key, courseName, courseCode, department, college, reason }) => <tr key={key}>
                <td>{courseName}{courseCode && <small>{courseCode}</small>}</td>
                <td>{department ?? (college ? `${college}・系所待確認` : "待確認")}
                  {reason && <small>{reason === "home-department" ? "本科系同名配對" : "依入學年度必修表對照"}</small>}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="mt-3 text-sm">這份成績單尚無可計入的修課紀錄。</p>}
        </section>
      </div>
    </div>
  </main>;
}
