import type { TeacherReviewGroup } from "./student-reviews";

export const unknownReviewAcademicYear = "unknown";

function reviewAcademicYear(semester: string): string {
  return semester.trim().match(/^(\d+)-[12]$/)?.[1] ?? unknownReviewAcademicYear;
}

export function getReviewAcademicYears(groups: TeacherReviewGroup[]): string[] {
  const years = new Set<string>();
  for (const { posts } of groups) {
    for (const { entries } of posts) {
      for (const { semester } of entries) years.add(reviewAcademicYear(semester));
    }
  }

  const hasUnknownYear = years.delete(unknownReviewAcademicYear);
  const availableYears = [...years].sort((a, b) => Number(b) - Number(a));
  if (hasUnknownYear) availableYears.push(unknownReviewAcademicYear);
  return availableYears;
}

export function filterTeacherReviewsByYear(groups: TeacherReviewGroup[], year: string): TeacherReviewGroup[] {
  if (!year) return [];

  return groups.map((group) => ({
    ...group,
    posts: group.posts.map((post) => ({
      ...post,
      entries: post.entries.filter((entry) => reviewAcademicYear(entry.semester) === year),
    })).filter((post) => post.entries.length > 0),
  })).filter((group) => group.posts.length > 0);
}
