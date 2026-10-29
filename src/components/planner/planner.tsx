"use client";

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatCredits } from "@/lib/credits";
import { eligibilityWarnings, evaluatePlan, type PlanCourse, type StudentPrior } from "@/lib/eligibility";
import { computeWarnings } from "@/lib/plan-warnings";
import { addEntry, moveEntry, removeEntry, updateEntry, type ActionResult } from "@/lib/plans/actions";
import { isEditable } from "@/lib/plans/schemas";
import { toTracked, toWarnEntry, type EntryView } from "@/lib/plans/view";
import { summarize, type GraduationSettings, type RequirementRuleInput } from "@/lib/requirements";
import { cn } from "@/lib/utils";
import { AddCoursePanel, type PanelCourse } from "./add-course-panel";
import { CourseRow, RowBody, type RowActions } from "./course-row";
import { RequirementRail } from "./requirement-rail";

interface Props {
  plan: { id: string; status: string };
  entries: EntryView[];
  courses: PanelCourse[];
  interests: { slug: string; label: string }[];
  rules: RequirementRuleInput[];
  settings: GraduationSettings;
  prior: StudentPrior;
}

/** The pointer decides when there is one. A keyboard drag has no pointer, so fall back to overlapping rectangles. */
const collision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length > 0 ? byPointer : rectIntersection(args);
};

function Column({ grade, credits, need, editable, count, onAdd, children }: {
  grade: number; credits: number; need: number; editable: boolean; count: number; onAdd: () => void; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `grade-${grade}` });
  const under = credits < need;
  return (
    <section
      ref={setNodeRef}
      aria-label={`Grade ${grade}`}
      className={cn("rounded-md transition-colors duration-150", isOver && "bg-raised")}
    >
      <header className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-sm font-medium">Grade {grade}</h2>
          <span className={cn("num", under ? "text-yellow" : "text-muted")} title={under ? `Minimum is ${need} credits` : undefined}>
            {formatCredits(credits)} cr
          </span>
        </div>
        {editable && <Button size="sm" variant="ghost" onClick={onAdd}>Add</Button>}
      </header>
      <ul className="list min-h-[3.5rem]">{children}</ul>
      {count === 0 && (
        <p className="py-4 text-[13px] text-muted">{editable ? "Nothing here yet. Add a course or drag one in." : "No courses."}</p>
      )}
    </section>
  );
}

export function Planner({ plan, entries: serverEntries, courses, interests, rules, settings, prior }: Props) {
  const editable = isEditable(plan.status);
  const [entries, setEntries] = useState(serverEntries);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ open: boolean; grade: number }>({ open: false, grade: 9 });
  const [, startTransition] = useTransition();

  // The server is the source of truth. When it sends fresh data, it replaces the optimistic copy.
  const [seen, setSeen] = useState(serverEntries);
  if (seen !== serverEntries) {
    setSeen(serverEntries);
    setEntries(serverEntries);
  }

  const summary = useMemo(() => summarize(entries.map(toTracked), rules, settings), [entries, rules, settings]);
  const names = useMemo(() => Object.fromEntries(courses.map((c) => [c.slug, c.name])), [courses]);
  const placements = useMemo<PlanCourse[]>(
    () =>
      entries.map((e) => ({
        key: e.id, slug: e.slug, name: e.name, gradeLevel: e.gradeLevel, status: e.status, grade: e.grade,
        rules: e.rules, prereqText: e.prereqText, approvedAppeal: e.approvedAppeal,
      })),
    [entries],
  );
  const results = useMemo(() => evaluatePlan(placements, { prior, names }), [placements, prior, names]);
  const warnings = useMemo(
    () => computeWarnings(entries.map(toWarnEntry), settings, eligibilityWarnings(placements, results)),
    [entries, settings, placements, results],
  );
  const inPlan = useMemo(() => new Set(entries.map((e) => e.courseId)), [entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  /** Show the change now, ask the server, and fall back to the server's copy if it says no. */
  function run(optimistic: () => void, action: () => Promise<ActionResult<unknown>>) {
    setError(null);
    optimistic();
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(r.error);
        setEntries(serverEntries);
      }
    });
  }

  const actions: RowActions = {
    onMove: (id, grade) => run(() => setEntries((es) => es.map((e) => (e.id === id ? { ...e, gradeLevel: grade } : e))), () => moveEntry({ entryId: id, gradeLevel: grade })),
    onRemove: (id) => run(() => setEntries((es) => es.filter((e) => e.id !== id)), () => removeEntry(id)),
    onUpdate: (id, patch) =>
      run(
        () =>
          setEntries((es) =>
            es.map((e) => {
              if (e.id !== id) return e;
              const status = patch.status ?? e.status;
              return {
                ...e,
                status,
                credits: patch.credits ?? e.credits,
                grade: status !== "COMPLETED" ? null : patch.grade !== undefined ? patch.grade : e.grade,
              };
            }),
          ),
        () => updateEntry({ entryId: id, ...patch }),
      ),
  };

  function add(course: PanelCourse, grade: number) {
    const temp: EntryView = {
      id: `tmp-${crypto.randomUUID()}`, courseId: course.id, slug: course.slug, name: course.name, department: course.department,
      level: course.level, duration: course.duration, gradeLevel: grade, status: "PLANNED", grade: null, credits: course.credits,
      courseCredits: course.courseCredits, gradesOffered: course.gradesOffered,
      tags: course.tags as EntryView["tags"], rules: course.rules, prereqText: course.prereqText, approvedAppeal: false,
    };
    run(() => setEntries((es) => [...es, temp]), () => addEntry({ planId: plan.id, courseId: course.id, gradeLevel: grade }));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over?.startsWith("grade-")) return;
    const grade = Number(over.slice(6));
    const entry = entries.find((x) => x.id === String(e.active.id));
    if (entry && entry.gradeLevel !== grade) actions.onMove(entry.id, grade);
  }

  const active = entries.find((e) => e.id === activeId);

  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        {!editable && (
          <p className="mb-6 border-y border-line py-3 text-[13px] text-muted">
            This plan is in review, so it is read-only. You can still look around.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-6 text-[13px] text-red">
            {error}
          </p>
        )}
        <DndContext id="planner-dnd" sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 2xl:grid-cols-4">
            {[9, 10, 11, 12].map((grade) => {
              const inGrade = entries.filter((e) => e.gradeLevel === grade);
              const year = summary.years.find((y) => y.grade === grade)!;
              return (
                <Column
                  key={grade}
                  grade={grade}
                  credits={year.total}
                  need={grade === 12 ? settings.minFinalYear : settings.minPerYear}
                  editable={editable}
                  count={inGrade.length}
                  onAdd={() => setPanel({ open: true, grade })}
                >
                  {inGrade.map((e) => (
                    <CourseRow key={e.id} entry={e} editable={editable} actions={actions} result={results.get(e.id)} />
                  ))}
                </Column>
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
            {active ? (
              <div className="flex items-center gap-3 rounded-md border border-line-strong bg-elevated px-3 py-2 shadow-[0_8px_24px_rgb(0_0_0/0.5)]">
                <RowBody entry={active} offered />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <RequirementRail summary={summary} warnings={warnings} />

      <AddCoursePanel
        open={panel.open}
        grade={panel.grade}
        onGradeChange={(g) => setPanel((p) => ({ ...p, grade: g }))}
        onClose={() => setPanel((p) => ({ ...p, open: false }))}
        courses={courses}
        inPlan={inPlan}
        placements={placements}
        prior={prior}
        names={names}
        interests={interests}
        onAdd={add}
      />
    </div>
  );
}
