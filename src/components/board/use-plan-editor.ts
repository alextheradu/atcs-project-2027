"use client";

import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useMemo, useState, useTransition } from "react";
import { SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import type { PanelCourse } from "@/components/planner/add-course-panel";
import { eligibilityWarnings, evaluatePlan, type PlanCourse, type StudentPrior } from "@/lib/eligibility";
import { guidanceFor, type GuidanceConfig } from "@/lib/guidance";
import { computeWarnings } from "@/lib/plan-warnings";
import { addEntry, moveEntry, removeEntry, updateEntry, type ActionResult } from "@/lib/plans/actions";
import { isEditable } from "@/lib/plans/schemas";
import { toTracked, toWarnEntry, type EntryView } from "@/lib/plans/view";
import { summarize, type GraduationSettings, type RequirementRuleInput } from "@/lib/requirements";
import { recoverPlanChange, type PlanChange } from "@/lib/drafts/planner";

export interface EntryPatch { status?: EntryView["status"]; grade?: string | null; credits?: number }

export interface EditorInput {
  plan: { id: string; status: string };
  entries: EntryView[];
  courses: PanelCourse[];
  rules: RequirementRuleInput[];
  settings: GraduationSettings;
  prior: StudentPrior;
  readOnly?: boolean;
  guidance?: { config: GuidanceConfig; intendedMajor: string | null };
}

/**
 * Everything the Board needs to show and change a plan: optimistic edits that fall back to the server's copy,
 * a saved draft of the one change in flight (so a reload mid-save can retry it), and the derived summary,
 * eligibility results and warnings. Behavior is the same as the old column planner.
 */
export function usePlanEditor({ plan, entries: serverEntries, courses, rules, settings, prior, readOnly = false, guidance }: EditorInput) {
  const [change, setChange, changeDraft] = useDraftState<PlanChange | null>(`plan:${plan.id}:pending`, null);
  const [pending, startTransition] = useTransition();
  const canEdit = isEditable(plan.status) && !readOnly;
  const editable = canEdit && !change && !pending;
  const [entries, setEntries] = useState(serverEntries);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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
  const advice = useMemo(
    () => (guidance ? guidanceFor(guidance.config, guidance.intendedMajor, entries.map((e) => ({ department: e.department, gradeLevel: e.gradeLevel }))) : null),
    [guidance, entries],
  );
  const inPlan = useMemo(() => new Set(entries.map((e) => e.courseId)), [entries]);

  // No keyboard sensor: tiles are buttons that open the class sheet, and the sheet moves a class by keyboard.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  /** Show the change now, ask the server, and fall back to the server's copy if it says no. */
  function run(next: PlanChange, optimistic: () => void, action: () => Promise<ActionResult<unknown>>) {
    if (!editable) return;
    setError(null);
    setChange(next);
    optimistic();
    startTransition(async () => {
      try {
        const r = await action();
        if (!r.ok) {
          setError(r.error);
          setEntries(serverEntries);
        } else changeDraft.discard();
      } catch { setError(SAVE_INTERRUPTED); setEntries(serverEntries); }
    });
  }

  function retry() {
    if (pending || !canEdit) return;
    const action = recoverPlanChange(change, serverEntries);
    if (!action) { changeDraft.discard(); setError(null); return; }
    if ("conflict" in action) { setError("This class has changed. Check the saved board, then discard this pending change and edit the class again."); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = action.kind === "add" ? await addEntry({ planId: plan.id, courseId: action.courseId, gradeLevel: action.gradeLevel })
          : action.kind === "move" ? await moveEntry({ entryId: action.entryId, gradeLevel: action.gradeLevel })
          : action.kind === "remove" ? await removeEntry(action.entryId)
          : await updateEntry({ entryId: action.entryId, ...action.patch });
        if (result.ok) changeDraft.discard();
        else setError(result.error);
      } catch { setError(SAVE_INTERRUPTED); }
    });
  }

  function discardChange() {
    changeDraft.discard();
    setEntries(serverEntries);
    setError(null);
  }

  const courseIdOf = (id: string) => entries.find((e) => e.id === id)!.courseId;

  const actions = {
    move: (id: string, grade: number) =>
      run({ kind: "move", courseId: courseIdOf(id), gradeLevel: grade }, () => setEntries((es) => es.map((e) => (e.id === id ? { ...e, gradeLevel: grade } : e))), () => moveEntry({ entryId: id, gradeLevel: grade })),
    remove: (id: string) =>
      run({ kind: "remove", courseId: courseIdOf(id) }, () => setEntries((es) => es.filter((e) => e.id !== id)), () => removeEntry(id)),
    update: (id: string, patch: EntryPatch) =>
      run(
        { kind: "update", courseId: courseIdOf(id), patch: patch as Extract<PlanChange, { kind: "update" }>["patch"] },
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
    add: (course: PanelCourse, grade: number) => {
      const temp: EntryView = {
        id: `tmp-${crypto.randomUUID()}`, courseId: course.id, slug: course.slug, name: course.name, department: course.department,
        level: course.level, duration: course.duration, gradeLevel: grade, status: "PLANNED", grade: null, credits: course.credits,
        courseCredits: course.courseCredits, gradesOffered: course.gradesOffered,
        tags: course.tags as EntryView["tags"], rules: course.rules, prereqText: course.prereqText, approvedAppeal: false,
      };
      run({ kind: "add", courseId: course.id, gradeLevel: grade }, () => setEntries((es) => [...es, temp]), () => addEntry({ planId: plan.id, courseId: course.id, gradeLevel: grade }));
    },
  };

  const drag = {
    sensors,
    active: entries.find((e) => e.id === activeId) ?? null,
    onDragStart: (e: DragStartEvent) => setActiveId(String(e.active.id)),
    onDragCancel: () => setActiveId(null),
    onDragEnd: (e: DragEndEvent) => {
      setActiveId(null);
      const over = e.over?.id ? String(e.over.id) : null;
      const m = over?.match(/^grade-(\d+)/);
      if (!m) return;
      const grade = Number(m[1]);
      const entry = entries.find((x) => x.id === String(e.active.id));
      if (entry && entry.gradeLevel !== grade) actions.move(entry.id, grade);
    },
  };

  return {
    entries, summary, results, warnings, advice, inPlan, names, placements,
    canEdit, editable, pending, change, changeDraft, error, retry, discardChange, actions, drag,
  };
}

export type PlanEditor = ReturnType<typeof usePlanEditor>;
