"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EligibilityBadge } from "@/components/eligibility/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildContext, evaluateCourse, type PlanCourse, type Rule, type StudentPrior } from "@/lib/eligibility";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { DEPT_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { filterCourses, type PickerCourse } from "@/lib/catalog/filter";
import { sortByFit } from "@/lib/catalog/fit-order";
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
  /** The board is saving a change. Add buttons wait until it is done. */
  busy?: boolean;
}

const LIMIT = 60;

export function AddCoursePanel({ open, grade, onGradeChange, onClose, courses, inPlan, placements, prior, names, interests, onAdd, requirement, onClearRequirement, busy = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState("");
  const [credits, setCredits] = useState("");
  const [interest, setInterest] = useState("");
  const [offeredOnly, setOfferedOnly] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Classes added while the panel is open stay in the list, marked as added, with the grade they went to.
  const [added, setAdded] = useState<Map<string, number>>(() => new Map());
  const [lastAdded, setLastAdded] = useState<{ name: string; grade: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const activeFilters = [department, level, duration, credits, interest].filter(Boolean).length + (offeredOnly ? 0 : 1);

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
      }).filter((c) => !inPlan.has(c.id) || added.has(c.id)),
    [courses, q, department, level, duration, credits, interest, offeredOnly, grade, inPlan, requirement, added],
  );

  // How each course would fare if added to this grade. A class just added is checked without itself,
  // so its row keeps the same result and place in the list.
  const fit = useMemo(() => {
    const ctx = buildContext(grade, placements, { prior, names });
    return new Map(
      results.map((c) => [
        c.id,
        evaluateCourse(c, added.has(c.id) ? buildContext(grade, placements.filter((p) => p.slug !== c.slug), { prior, names }) : ctx),
      ]),
    );
  }, [results, grade, placements, prior, names, added]);

  // Classes the student can take come first. Inside a tier the search order stays.
  const shown = useMemo(() => sortByFit(results, (c) => fit.get(c.id)).slice(0, LIMIT), [results, fit]);

  const add = (c: PanelCourse) => {
    onAdd(c, grade);
    setAdded((m) => new Map(m).set(c.id, grade));
    setLastAdded({ name: c.name, grade });
  };

  const handleClose = () => {
    setAdded(new Map());
    setLastAdded(null);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={handleClose}
      onClick={(e) => e.target === ref.current && handleClose()}
      aria-label="Add a course"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[460px] bg-fill p-0 text-fg backdrop:bg-black/60 md:rounded-l-[20px]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">Add a class to</h2>
            <select className="input !h-9 !w-auto bg-fill-2" value={grade} onChange={(e) => onGradeChange(Number(e.target.value))} aria-label="Grade to add to">
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th grade</option>)}
            </select>
          </div>
          <Button size="sm" variant="ghost" onClick={handleClose}>Done</Button>
        </header>

        <div className="space-y-2.5 px-5 pb-4 pt-2">
          <p role="status" className={lastAdded ? "pb-1" : "sr-only"}>
            {lastAdded && (
              <Badge tone="eligible" className="whitespace-normal text-[14px]">
                Added {lastAdded.name} to {lastAdded.grade}th grade
              </Badge>
            )}
          </p>
          {requirement && (
            <p className="flex items-center justify-between gap-3 rounded-[12px] bg-fill-2 px-3 py-2 text-[14px]">
              <span>Showing classes that count toward <span className="font-semibold">{requirement.label}</span></span>
              <button type="button" className="shrink-0 text-[13px] font-medium text-accent-ink hover:underline" onClick={onClearRequirement}>Show all</button>
            </p>
          )}
          <div className="flex gap-2">
            <input className="input min-w-0 flex-1 bg-fill-2" autoFocus placeholder="Search classes" aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button
              variant="ghost"
              className="shrink-0"
              aria-expanded={filtersOpen}
              aria-controls="add-course-filters"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              Filters{activeFilters > 0 && <span className="num"> ({activeFilters})</span>}
            </Button>
          </div>
          {filtersOpen && (
            <div id="add-course-filters" className="space-y-2.5">
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
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <p className="py-2 text-[13px] text-muted">
            {results.length} {results.length === 1 ? "class" : "classes"}
            {results.length > LIMIT && `, showing ${LIMIT}`}
          </p>
          <ul className="list pb-8">
            {shown.map((c) => {
              const r = fit.get(c.id);
              // Why a class is not a clean fit, or what a person still decides. Visible, since phones have no hover.
              const reason = !r ? null : r.status !== "ELIGIBLE" ? r.summary : (r.notes[0] ?? null);
              const addedTo = added.get(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{c.name}</span>
                      {r && r.status !== "ELIGIBLE" && <EligibilityBadge result={r} className="shrink-0" />}
                    </span>
                    <span className="block truncate text-[13px] text-muted">
                      {DEPT_LABEL[c.department]}, {LEVEL_LABEL[c.level]}, grades {c.gradesOffered.join(", ")}
                    </span>
                    {reason && <span className="mt-0.5 line-clamp-2 text-[13px] text-muted">{reason}</span>}
                  </span>
                  <span className="num shrink-0 text-muted">{formatCredits(c.credits)} cr</span>
                  {addedTo !== undefined ? (
                    <Button size="sm" variant="ghost" disabled aria-label={`Added to ${addedTo}th grade`}>Added</Button>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => add(c)}>Add</Button>
                  )}
                </li>
              );
            })}
          </ul>
          {results.length === 0 && (
            <p className="py-10 text-center text-[14px] text-muted">
              No classes match. Try another search, or open Filters and clear one.
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
