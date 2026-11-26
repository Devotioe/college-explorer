import { useId } from "react";
import type { SemesterPlanEdge } from "../lib/course-map";

type Course = { id: string; title: string; school: "NCCU" | "NTHU" };
type Entry<T> = { course: T; target: boolean };
type PendingCourse = { title: string; semester: number; reason: string };

const cardWidth = 220;
const columnGap = 60;
const cardHeight = 72;
const rowGap = 12;
const headingHeight = 36;
const padding = 16;

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }, laneY?: number) {
  const start = from.x + cardWidth;
  const end = to.x - 3;
  if (laneY !== undefined) return `M${start} ${from.y} H${start + 16} V${laneY} H${end - 16} V${to.y} H${end}`;
  const mid = (start + end) / 2;
  return `M${start} ${from.y} C${mid} ${from.y} ${mid} ${to.y} ${end} ${to.y}`;
}

export function SemesterPlanMap<T extends Course>({ semesters, edges, pending, selectedId, openDetails }: {
  semesters: [number, Entry<T>[]][];
  edges: SemesterPlanEdge[];
  pending: PendingCourse[];
  selectedId?: string;
  openDetails: (course: T) => void;
}) {
  const arrowId = useId();
  const lastSemester = Math.max(semesters.at(-1)?.[0] ?? 0, ...pending.map(({ semester }) => semester));
  if (!lastSemester) return null;

  const bySemester = new Map(semesters);
  const pendingBySemester = Map.groupBy(pending, ({ semester }) => semester);
  const columns = Array.from({ length: lastSemester }, (_, i) => bySemester.get(i + 1) ?? []);
  const courseTerms = new Map(semesters.flatMap(([semester, entries]) => entries.map(({ course }) => [course.id, semester] as const)));
  const longEdges = edges.filter(({ from, to }) => (courseTerms.get(to) ?? 0) > (courseTerms.get(from) ?? 0) + 1);
  const firstRow = padding + headingHeight + (longEdges.length ? 10 + longEdges.length * 7 : 0);
  const tallest = Math.max(...columns.map((entries, column) => entries.length + (pendingBySemester.get(column + 1)?.length ?? 0)));
  const width = padding * 2 + columns.length * cardWidth + (columns.length - 1) * columnGap;
  const height = firstRow + tallest * cardHeight + (tallest - 1) * rowGap + padding;
  const positions = new Map(semesters.flatMap(([semester, entries]) => entries.map(({ course }, row) => [course.id, {
    title: course.title,
    x: padding + (semester - 1) * (cardWidth + columnGap),
    y: firstRow + row * (cardHeight + rowGap) + cardHeight / 2,
  }] as const)));
  const edgesByTarget = Map.groupBy(edges, ({ to }) => to);

  return <>
    {edges.length > 0 && <div className="semester-map-legend">
      {edges.some(({ alternative }) => !alternative) && <span><i />官方先修</span>}
      {edges.some(({ alternative }) => alternative) && <span><i className="semester-map-alternative" />擇一路徑</span>}
    </div>}
    <div className="semester-map-scroll" role="region" aria-label="逐學期課程地圖，可橫向捲動" tabIndex={0}>
      <div className="semester-map" style={{ width, minHeight: height, padding }}>
        {edges.length > 0 && <svg className="semester-map-links" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs><marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 Z" />
          </marker></defs>
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const lane = longEdges.indexOf(edge);
            return <path key={`${edge.from}:${edge.to}`} className="semester-map-edge" data-alternative={edge.alternative}
              d={edgePath(from, to, lane < 0 ? undefined : padding + headingHeight + 7 * (lane + 1))} markerEnd={`url(#${arrowId})`} />;
          })}
        </svg>}
        <ol className="semester-map-columns" style={{ gap: columnGap, gridTemplateColumns: `repeat(${columns.length}, ${cardWidth}px)` }}>
          {columns.map((entries, column) => {
            const pendingCourses = pendingBySemester.get(column + 1) ?? [];
            return <li key={column + 1}>
              <h3 style={{ height: headingHeight }}>規劃第 {column + 1} 學期</h3>
              {entries.length || pendingCourses.length ? <ul className="semester-map-courses" style={{ gap: rowGap, marginTop: firstRow - padding - headingHeight }}>
                {entries.map(({ course, target }) => {
                  const incoming = edgesByTarget.get(course.id) ?? [];
                  const role = course.id === selectedId ? "目標課" : target ? "系定必修" : "官方先修";
                  return <li key={course.id}>
                    <button type="button" className="semester-map-course" data-target={course.id === selectedId} style={{ height: cardHeight }}
                      onClick={() => openDetails(course)}>
                      <span className="semester-map-course-title">{course.title}</span>
                      <span className="semester-map-course-meta">{course.school === "NTHU" ? "清大" : "政大"}・{role}</span>
                      {incoming.length > 0 && <span className="sr-only">先修連線 {incoming.map(({ from, alternative }) => `${positions.get(from)?.title}${alternative ? "（擇一路徑）" : ""}`).join("、")}</span>}
                    </button>
                  </li>;
                })}
                {pendingCourses.map(({ title, reason }) => <li key={title} className="semester-map-course semester-map-course-pending" style={{ height: cardHeight }}>
                  <span className="semester-map-course-title">{title}</span>
                  <span className="semester-map-course-meta">{reason}</span>
                </li>)}
              </ul> : <p className="semester-map-empty">這學期沒有已排入的課程。</p>}
            </li>;
          })}
        </ol>
      </div>
    </div>
  </>;
}
