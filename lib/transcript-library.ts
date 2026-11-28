import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { transcriptAnalysisSources, transcriptCourseRows, transcriptUploads } from "../db/schema";
import { nccuTranscriptCatalog, resolveNccuTranscriptCourse } from "./nccu-course-match";
import { buildNccuStudyProfile } from "./nccu-study-profile";
import { normalizeTranscriptTerm, type TranscriptRow } from "./transcript-review";

export function ownedTranscript(userId: string, id: string) {
  return and(eq(transcriptUploads.id, id), eq(transcriptUploads.userId, userId), eq(transcriptUploads.status, "confirmed"));
}

export async function readTranscriptRows(id: string) {
  return getDb().select({
    id: transcriptCourseRows.id, term: transcriptCourseRows.term, courseCode: transcriptCourseRows.courseCode,
    courseName: transcriptCourseRows.courseName, gradeRaw: transcriptCourseRows.gradeRaw,
    credits: transcriptCourseRows.credits, confidence: transcriptCourseRows.matchConfidence,
  }).from(transcriptCourseRows).where(and(eq(transcriptCourseRows.transcriptId, id), eq(transcriptCourseRows.confirmed, true)))
    .orderBy(asc(transcriptCourseRows.term), asc(transcriptCourseRows.courseName));
}

export function analyzeTranscript(upload: { homeDepartment?: string | null; admissionYear?: string | null }, rows: readonly TranscriptRow[]) {
  return buildNccuStudyProfile(rows.map((savedRow) => {
    const row = { ...savedRow, term: normalizeTranscriptTerm(savedRow.term) };
    const match = resolveNccuTranscriptCourse(row, upload.homeDepartment ?? "", upload.admissionYear ?? "");
    return match ? { ...row, courseCode: match.code, assignmentReason: match.reason } : row;
  }), nccuTranscriptCatalog);
}

export async function readTranscriptLibrary(userId: string) {
  const db = getDb();
  const confirmedRows = db.select({ count: sql<number>`count(*)` }).from(transcriptCourseRows)
    .where(and(eq(transcriptCourseRows.transcriptId, transcriptUploads.id), eq(transcriptCourseRows.confirmed, true)));
  const results = await db.select({
    id: transcriptUploads.id, fileName: transcriptUploads.fileName, fileType: transcriptUploads.fileType,
    homeDepartment: transcriptUploads.homeDepartment, admissionYear: transcriptUploads.admissionYear,
    createdAt: transcriptUploads.createdAt, confirmedAt: transcriptUploads.confirmedAt,
    preferredId: transcriptAnalysisSources.transcriptId, rowCount: sql<number>`(${confirmedRows})`,
  }).from(transcriptUploads).leftJoin(transcriptAnalysisSources, eq(transcriptAnalysisSources.userId, transcriptUploads.userId))
    .where(and(eq(transcriptUploads.userId, userId), eq(transcriptUploads.status, "confirmed")))
    .orderBy(desc(transcriptUploads.createdAt), desc(transcriptUploads.id));
  const transcripts = results.map(({ preferredId, ...transcript }) => transcript);
  const realTranscripts = transcripts.filter(({ fileType }) => fileType !== "sample");
  const chosen = realTranscripts.find(({ id }) => id === results[0]?.preferredId) ?? realTranscripts[0];
  if (!chosen) return { transcripts, activeTranscript: null, profile: null };
  const rows = await readTranscriptRows(chosen.id);
  return { transcripts, activeTranscript: { ...chosen, rows }, profile: analyzeTranscript(chosen, rows) };
}
