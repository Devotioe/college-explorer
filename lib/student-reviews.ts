import published from "../data/dcard/processed/published.json" with { type: "json" };

type ReviewEvidence = "article" | "archived_summary" | "archived_comment";
export type ReviewDetails = {
  teaching?: string;
  workload?: string;
  assessment?: string;
  studentAdvice?: string;
};

export type StudentCourseReview = {
  id: string;
  teacher: string;
  semester: string;
  summary: string;
  sourceUrl: string;
  sourceEvidence: ReviewEvidence;
};

export type TeacherReviewEntry = StudentCourseReview & {
  course: string;
  isCurrentCourse: boolean;
  details?: ReviewDetails;
};

export type TeacherReviewGroup = {
  teacher: string;
  posts: { sourceUrl: string; entries: TeacherReviewEntry[] }[];
};

type ProcessedReview = {
  id: string;
  courseId: string;
  teacher: string;
  semester: string;
  summary: string;
  url: string;
  postId: string;
  sourceEvidence: string;
  verificationStatus: string;
  course: string;
  details?: ReviewDetails;
};

type IndexedReview = {
  courseId: string;
  course: string;
  details?: ReviewDetails;
  review: StudentCourseReview;
};

const reviewEvidenceRank = { article: 3, archived_summary: 2, archived_comment: 1 };

function* publishedEntries(rows: readonly ProcessedReview[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    const { id, courseId, teacher, semester, summary, url, postId, sourceEvidence, verificationStatus } = row;
    if (verificationStatus !== "published" || !courseId.startsWith("nccu-") || seen.has(id)) continue;
    if (!/^\d+$/.test(postId) || url !== `https://www.dcard.tw/f/nccu/p/${postId}` || !teacher.trim() || !summary.trim()) continue;
    if (sourceEvidence !== "article" && sourceEvidence !== "archived_summary" && sourceEvidence !== "archived_comment") continue;
    seen.add(id);
    const review: StudentCourseReview = { id, teacher, semester, summary, sourceUrl: url, sourceEvidence };
    yield { courseId, course: row.course, details: row.details, review };
  }
}

export function indexPublishedReviews(rows: readonly ProcessedReview[]) {
  const index = new Map<string, StudentCourseReview[]>();
  for (const { courseId, review } of publishedEntries(rows)) {
    if (!index.has(courseId)) index.set(courseId, []);
    index.get(courseId)!.push(review);
  }
  return index;
}

function entriesForTeacherPost(batch: IndexedReview[]): TeacherReviewEntry[] {
  const entries: TeacherReviewEntry[] = [];
  const terms = [...new Set(batch.map(({ review }) => review.semester).filter(Boolean))];
  const ranked = batch.toSorted((a, b) =>
    reviewEvidenceRank[b.review.sourceEvidence] - reviewEvidenceRank[a.review.sourceEvidence]
    || Object.keys(b.details ?? {}).length - Object.keys(a.details ?? {}).length,
  );
  for (const semester of terms.length ? terms : [""]) {
    // A blank term can support a single identified occurrence in this post.
    const entry = ranked.find(({ review }) => review.semester === semester || (terms.length === 1 && !review.semester));
    if (!entry) continue;
    entries.push({
      ...entry.review,
      semester,
      course: entry.course,
      details: entry.details,
      isCurrentCourse: true,
    });
  }
  return entries;
}

export function indexTeacherReviews(rows: readonly ProcessedReview[]) {
  const byCourse = Map.groupBy(publishedEntries(rows), (entry) => entry.courseId);
  return {
    get(courseId: string): TeacherReviewGroup[] {
      const byTeacher = new Map<string, Map<string, IndexedReview[]>>();
      for (const entry of byCourse.get(courseId) ?? []) {
        const { teacher, sourceUrl } = entry.review;
        for (const name of new Set(teacher.split("、").map((part) => part.trim()).filter(Boolean))) {
          if (!byTeacher.has(name)) byTeacher.set(name, new Map());
          const posts = byTeacher.get(name)!;
          if (!posts.has(sourceUrl)) posts.set(sourceUrl, []);
          posts.get(sourceUrl)!.push(entry);
        }
      }
      return [...byTeacher].sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
        .map(([teacher, posts]) => ({
          teacher,
          posts: Array.from(posts, ([sourceUrl, batch]) => ({ sourceUrl, entries: entriesForTeacherPost(batch) })),
        }));
    },
  };
}

const reviewsByCourse = indexPublishedReviews(published);
const teacherReviews = indexTeacherReviews(published);

export function reviewsForCourse(courseId: string): readonly StudentCourseReview[] {
  return reviewsByCourse.get(courseId) ?? [];
}

export function teacherReviewsForCourse(courseId: string): TeacherReviewGroup[] {
  return teacherReviews.get(courseId);
}
