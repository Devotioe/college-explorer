"use client";

import { GitCompareArrows, Plus, RefreshCw, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type CourseOption = {
  id: string; school: "NCCU" | "NTHU"; title: string; titleEn: string; code: string; unit: string;
  credits: number; time: string; language: string; tags: string[]; summary: string; offeringCodes?: string[];
};

export type ComparisonSlots<T> = [T | null, T | null];
type Slot = 0 | 1;

function searchKey(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function CourseComparison<T extends CourseOption>({ target, catalog, related, courses, onChange, schoolLabels }: {
  target: T; catalog: readonly T[]; related: readonly T[]; courses: ComparisonSlots<T>; onChange: (slot: Slot, course: T | null) => void;
  schoolLabels: Record<CourseOption["school"], string>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const options = useMemo(() => {
    if (editing === null) return [];
    const blocked = new Set([target.id, courses[1 - editing]?.id]);
    const terms = searchKey(query).split(/\s+/u).filter(Boolean);
    const choices = new Map<string, T>();
    for (const course of [...related, ...catalog]) {
      if (blocked.has(course.id) || choices.has(course.id)) continue;
      const codes = [course.code, ...(course.offeringCodes ?? [])];
      const searchText = searchKey([course.title, course.titleEn, course.code, course.unit,
        schoolLabels[course.school], ...codes, ...codes.map((code) => code.replace(/[\s\p{Pd}]/gu, ""))].join(" "));
      if (terms.every((term) => searchText.includes(term))) choices.set(course.id, course);
      if (choices.size === 12) break;
    }
    return [...choices.values()];
  }, [catalog, courses, editing, query, related, schoolLabels, target.id]);

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) setEditing(null);
  }

  function choose(slot: Slot, course: T | null) {
    onChange(slot, course);
    setEditing(null);
    requestAnimationFrame(() => controls.current[slot]?.focus());
  }

  function edit(slot: Slot) {
    setQuery("");
    setEditing(slot);
  }

  return <Popover open={open} onOpenChange={toggle}>
    <PopoverTrigger asChild>
      <button type="button" className="learning-compare-trigger"><GitCompareArrows size={14} aria-hidden="true" />比較課程</button>
    </PopoverTrigger>
    <PopoverContent aria-labelledby={titleId} side="top" align="start" sideOffset={12} collisionPadding={12} className="course-compare-panel">
      <header className="course-compare-header">
        <h2 id={titleId}>課程比較</h2>
        <button type="button" className="course-compare-icon" aria-label="關閉課程比較" onClick={() => toggle(false)}><X size={17} /></button>
      </header>
      <div className="course-compare-grid">
        <div className="course-compare-card" data-target="true">
          <CourseFacts course={target} school={schoolLabels[target.school]} target />
        </div>
        {([0, 1] as const).map((slot) => {
          const course = courses[slot];
          return course ? <div key={slot} className="course-compare-card" data-editing={editing === slot}>
            <CourseFacts course={course} school={schoolLabels[course.school]} />
            <div className="course-compare-actions">
              <button type="button" className="course-compare-action" ref={(node) => { controls.current[slot] = node; }}
                aria-label={`更換 ${course.title}`} onClick={() => edit(slot)}><RefreshCw size={14} />更換</button>
              <button type="button" className="course-compare-icon" aria-label={`移除 ${course.title}`} onClick={() => choose(slot, null)}><X size={15} /></button>
            </div>
          </div> : <button type="button" key={slot} className="course-compare-card course-compare-empty" data-editing={editing === slot}
            ref={(node) => { controls.current[slot] = node; }} aria-label={`加入比較課程 ${slot + 1}`} onClick={() => edit(slot)}>
            <Plus size={20} aria-hidden="true" />加入比較課程
          </button>;
        })}
      </div>
      {editing !== null && <Command shouldFilter={false} className="course-compare-search">
        <CommandInput aria-label="搜尋要比較的課程" placeholder="輸入課名、課號或系所" value={query} onValueChange={setQuery} autoFocus />
        <CommandList className="max-h-40" aria-label="可比較課程">
          <CommandEmpty>沒有符合的課程</CommandEmpty>
          {options.map((course) => <CommandItem key={course.id} value={course.id} onSelect={() => choose(editing, course)} className="course-compare-option">
            <strong>{course.title}</strong><span>{schoolLabels[course.school]} · {course.code} · {course.unit}</span>
          </CommandItem>)}
        </CommandList>
      </Command>}
    </PopoverContent>
  </Popover>;
}

function CourseFacts({ course, school, target = false }: { course: CourseOption; school: string; target?: boolean }) {
  return <>
    <div className="course-compare-meta"><span>{school} · {course.code}</span>{target && <span className="course-compare-reference">地圖目標</span>}</div>
    <h3>{course.title}</h3>
    <dl>
      <div><dt>開課單位</dt><dd>{course.unit || "未公布"}</dd></div>
      <div><dt>學分</dt><dd>{course.credits}</dd></div>
      <div><dt>時間</dt><dd>{course.time || "未公布"}</dd></div>
      <div><dt>授課語言</dt><dd>{course.language}</dd></div>
      {!!course.tags.length && <div><dt>主題</dt><dd>{course.tags.join("、")}</dd></div>}
    </dl>
    {course.summary && <details><summary>課程簡介</summary><p>{course.summary}</p></details>}
  </>;
}
