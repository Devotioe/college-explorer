import reviewedHighlights from "../data/course-highlights.json" with { type: "json" };
import seed from "../data/course-seed.json" with { type: "json" };

const courseTextById = new Map(seed.records.map(({ course }) => [course.id, {
  school: course.school,
  description: course.description?.trim() ?? "",
  objectives: course.objectives?.trim() ?? "",
  prerequisites: course.prerequisites?.trim() ?? "",
}]));
const highlightsByCourse = new Map(Object.entries(reviewedHighlights));

export function getCourseDetailText(courseId: string, stored: { description?: unknown; objectives?: unknown }) {
  const seeded = courseTextById.get(courseId);
  const nccuSource = seeded?.school === "NCCU" ? seeded : undefined;
  const description = typeof stored.description === "string" ? stored.description.trim() : "";
  const objectives = typeof stored.objectives === "string" ? stored.objectives.trim() : "";
  // Older database entries stored the first 600 characters and omitted objectives.
  return {
    description: nccuSource?.description.startsWith(description) ? nccuSource.description : description,
    objectives: objectives || nccuSource?.objectives || "",
  };
}

export function getReviewedCourseHighlights(courseId: string, text: { description: string; objectives: string }) {
  const seedText = courseTextById.get(courseId);
  if (seedText?.description === text.description && seedText.objectives === text.objectives) {
    return highlightsByCourse.get(courseId);
  }
}

export function getCoursePrerequisites(courseId: string, stored: unknown) {
  const text = typeof stored === "string" ? stored.trim() : "";
  const source = courseTextById.get(courseId);
  // Restore the full condition when the existing D1 row has the old 300-character prefix.
  if (source?.school === "NCCU" && typeof stored === "string" && stored.length === 300
    && text && source.prerequisites.startsWith(text)) {
    return source.prerequisites;
  }
  return text;
}
