"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EligibilityBadge } from "@/components/eligibility/status-badge";
import { Button } from "@/components/ui/button";
import { buildContext, evaluateCourse, type PlanCourse, type Rule, type StudentPrior } from "@/lib/eligibility";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { DEPT_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { filterCourses, type PickerCourse } from "@/lib/catalog/filter";
import { LEVELS } from "@/lib/catalog/schemas";
import { formatCredits } from "@/lib/credits";

export interface PanelCourse extends PickerCourse {
  tags: { kind: string; credits: number; provisional: boolean }[];
  courseCredits: number;
  rules: Rule | null;
  prereqText: string | null;
}

interface Props {
  open: boolean;
  grade: number;
  onGradeChange: (g: number) => void;
  onClose: () => void;
  courses: PanelCourse[];
  inPlan: Set<string>;
  placements: PlanCourse[];
  prior: StudentPrior;
  names: Record<string, string>;
  interests: { slug: string; label: string }[];
  onAdd: (course: PanelCourse, grade: number) => void;
  /** Set when the panel was opened from an empty spot: only classes that count toward it. */
  requirement?: { kind: string; label: string } | null;
  onClearRequirement?: () => void;
}

const LIMIT = 60;

export function AddCoursePanel({ open, grade, onGradeChange, onClose, courses, inPlan, placements, prior, names, interests, onAdd, requirement, onClearRequirement }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState("");
  const [credits, setCredits] = useState("");
  const [interest, setInterest] = useState("");
  const [offeredOnly, setOfferedOnly] = useState(true);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo(
    () =>
      filterCourses(courses, {
        q,
        department: department || undefined,
        level: level || undefined,
        duration: (duration || undefined) as "FULL" | "HALF" | undefined,
        credits: credits ? Number(credits) : undefined,
        interest: interest || undefined,
        grade: offeredOnly ? grade : undefined,
        requirement: requirement?.kind,
      }).filter((c) => !inPlan.has(c.id)),
    [courses, q, department, level, duration, credits, interest, offeredOnly, grade, inPlan, requirement],
  );

  // How each shown course would fare if added to this grade.
  const shown = results.slice(0, LIMIT);
  const fit = useMemo(() => {
    const ctx = buildContext(grade, placements, { prior, names });
    return new Map(shown.map((c) => [c.id, evaluateCourse(c, ctx)]));
  }, [shown, grade, placements, prior, names]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Add a course"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[460px] bg-fill p-0 text-fg backdrop:bg-black/60 md:rounded-l-[20px]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold tracking-[-0.02em]">Add a class to</h2>
            <select className="input !h-9 !w-auto bg-fill-2" value={grade} onChange={(e) => onGradeChange(Number(e.target.value))} aria-label="Grade to add to">
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th grade</option>)}
            </select>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
        </header>

        <div className="space-y-2.5 px-5 pb-4 pt-2">
          {requirement && (
            <p className="flex items-center justify-between gap-3 rounded-[12px] bg-fill-2 px-3 py-2 text-[14px]">
              <span>Showing classes that count toward <span className="font-semibold">{requirement.label}</span></span>
              <button type="button" className="shrink-0 text-[13px] font-medium text-accent-ink hover:underline" onClick={onClearRequirement}>Show all</button>
            </p>
          )}
          <input className="input bg-fill-2" autoFocus placeholder="Search classes" aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input bg-fill-2" aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
            </select>
            <select className="input bg-fill-2" aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {LEVELS.filter((l) => l !== "MIDDLE_SCHOOL").map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            <select className="input bg-fill-2" aria-label="Length" value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">Any length</option>
              <option value="FULL">Full year</option>
              <option value="HALF">Half year</option>
            </select>
            <select className="input bg-fill-2" aria-label="Credits" value={credits} onChange={(e) => setCredits(e.target.value)}>
              <option value="">Any credits</option>
              <option value="2.5">2.5</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
            </select>
            <select className="input col-span-2 bg-fill-2" aria-label="Interest" value={interest} onChange={(e) => setInterest(e.target.value)}>
              <option value="">Any interest</option>
              {interests.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[14px] text-muted">
            <input type="checkbox" checked={offeredOnly} onChange={(e) => setOfferedOnly(e.target.checked)} />
            Only classes offered in {grade}th grade
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <p className="py-2 text-[13px] text-muted">
            {results.length} {results.length === 1 ? "class" : "classes"}
            {results.length > LIMIT && `, showing ${LIMIT}`}
          </p>
          <ul className="list pb-8">
            {shown.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium">{c.name}</span>
                    {fit.get(c.id) && fit.get(c.id)!.status !== "ELIGIBLE" && <EligibilityBadge result={fit.get(c.id)!} className="shrink-0" />}
                  </span>
                  <span className="block truncate text-[13px] text-muted">
                    {DEPT_LABEL[c.department]}, {LEVEL_LABEL[c.level]}, grades {c.gradesOffered.join(", ")}
                  </span>
                </span>
                <span className="num shrink-0 text-muted">{formatCredits(c.credits)} cr</span>
                <Button size="sm" onClick={() => onAdd(c, grade)}>Add</Button>
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p className="py-10 text-center text-[14px] text-muted">No classes match. Try clearing a filter, or untick the grade box.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
