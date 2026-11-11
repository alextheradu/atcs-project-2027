"use client";

import { DndContext, DragOverlay, pointerWithin, rectIntersection, useDroppable, type CollisionDetection } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { DraftNotice } from "@/components/draft-state";
import { AddCoursePanel, type PanelCourse } from "@/components/planner/add-course-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GRADES, KIND_NOUN, ROWS, buildBoard, statusSentence, type BoardRow, type Grade, type Spot } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import type { EvalResult, StudentPrior } from "@/lib/eligibility";
import type { GuidanceConfig } from "@/lib/guidance";
import { describeWarning, type PlanWarning } from "@/lib/plan-warnings";
import { PLAN_STATUS_LABEL, type EntryView } from "@/lib/plans/view";
import type { GraduationSettings, RequirementKind, RequirementRuleInput } from "@/lib/requirements";
import { cn } from "@/lib/utils";
import { ClassSheet } from "./class-sheet";
import { DragGhost, DraggableTile, StaticTile } from "./tile";
import { usePlanEditor, type PlanEditor } from "./use-plan-editor";

export interface BoardProps {
  title: string;
  plan: { id: string; status: string };
  entries: EntryView[];
  courses: PanelCourse[];
  interests: { slug: string; label: string }[];
  rules: RequirementRuleInput[];
  settings: GraduationSettings;
  prior: StudentPrior;
  currentGrade: number | null;
  /** Counselor view: nobody edits from here. */
  readOnly?: boolean;
  guidance?: { config: GuidanceConfig; intendedMajor: string | null };
  /** Server-rendered notes (unread notices, open reviews, dates) shown under the status line. */
  notes?: React.ReactNode;
  tour?: boolean;
  /** Shown beside "For college" under the board, such as the review and comments. */
  footer?: React.ReactNode;
}

const ordinal = (g: number) => `${g}th`;
const collision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length > 0 ? byPointer : rectIntersection(args);
};

interface AddTarget { grade: number; requirement: { kind: RequirementKind; label: string } | null }

function SpotTile({ spot, editable, onPick }: { spot: Spot; editable: boolean; onPick: (s: Spot) => void }) {
  if (!editable) return <div className="tile-empty">{spot.label}</div>;
  return (
    <button type="button" className="tile-empty" onClick={() => onPick(spot)} aria-label={`${spot.label} for ${ordinal(spot.gradeLevel)} grade`}>
      + {spot.label}
    </button>
  );
}

function Cell({ row, grade, children }: { row: BoardRow; grade: Grade; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `grade-${grade}-${row.key}` });
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${row.label}, ${ordinal(grade)} grade`}
      className={cn("flex min-h-[44px] flex-col gap-1.5 rounded-[12px] transition-colors duration-150", isOver && "bg-fill")}
    >
      {children}
    </div>
  );
}

function YearHead({ grade, ed, settings }: { grade: Grade; ed: PlanEditor; settings: GraduationSettings }) {
  const year = ed.summary.years.find((y) => y.grade === grade)!;
  const count = ed.entries.filter((e) => e.gradeLevel === grade).length;
  const need = grade === 12 ? settings.minFinalYear : settings.minPerYear;
  const under = count > 0 && year.total < need;
  // An overfull year is said here, in its own column, instead of in a list above the board.
  const full = ed.warnings.find((w): w is Extract<PlanWarning, { code: "TOO_MANY_PERIODS" }> => w.code === "TOO_MANY_PERIODS" && w.grade === grade);
  return (
    <div className="px-1 pb-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold">{ordinal(grade)}</span>
        <span className={cn("num text-[13px]", under ? "text-yellow" : "text-muted")} title={under ? `The minimum is ${need} credits` : undefined}>
          {formatCredits(year.total)}{under && ` of ${need}`} cr
        </span>
      </div>
      {full && (
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-yellow" title={describeWarning(full)}>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-yellow" />
          <span><span className="num">{full.periods}</span> periods, most fit <span className="num">{full.max}</span></span>
        </p>
      )}
    </div>
  );
}

function RowHead({ row }: { row: BoardRow }) {
  return (
    <div className={cn("flex flex-col justify-center pr-3", `subject-${row.key}`)}>
      <span className="ink text-[14px] font-bold leading-tight">{row.label}</span>
      <span className={cn("text-[12px]", row.status === "Done" ? "text-green" : "text-muted")}>{row.status === "Done" ? "✓ Done" : row.status}</span>
    </div>
  );
}

/** Desktop and tablet: subjects down the side, grades across the top, drag between grades. */
function Grid({ rows, ed, results, warns, settings, onOpen, onPick }: {
  rows: BoardRow[]; ed: PlanEditor; results: Map<string, EvalResult>; warns: Map<string, PlanWarning[]>; settings: GraduationSettings; onOpen: (id: string) => void; onPick: (s: Spot) => void;
}) {
  const byId = useMemo(() => new Map(ed.entries.map((e) => [e.id, e])), [ed.entries]);
  return (
    <DndContext id="board-dnd" sensors={ed.drag.sensors} collisionDetection={collision} onDragStart={ed.drag.onDragStart} onDragEnd={ed.drag.onDragEnd} onDragCancel={ed.drag.onDragCancel}>
      <div className="hidden grid-cols-[150px_repeat(4,minmax(0,1fr))] gap-x-2 gap-y-2 md:grid">
        <div />
        {GRADES.map((g) => <YearHead key={g} grade={g} ed={ed} settings={settings} />)}
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <RowHead row={row} />
            {GRADES.map((g) => (
              <Cell key={g} row={row} grade={g}>
                {row.cells[g].entryIds.map((id) => {
                  const e = byId.get(id)!;
                  return <DraggableTile key={id} entry={e} result={results.get(id)} warnings={warns.get(id)} disabled={!ed.editable} onOpen={() => onOpen(id)} />;
                })}
                {row.cells[g].spots.map((s, i) => <SpotTile key={`${s.kind}-${i}`} spot={s} editable={ed.editable} onPick={onPick} />)}
              </Cell>
            ))}
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {ed.drag.active ? <DragGhost entry={ed.drag.active} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Phones: one grade at a time, or every year as small colored blocks. */
function PhoneBoard({ rows, ed, results, warns, settings, start, onOpen, onPick }: {
  rows: BoardRow[]; ed: PlanEditor; results: Map<string, EvalResult>; warns: Map<string, PlanWarning[]>; settings: GraduationSettings; start: Grade; onOpen: (id: string) => void; onPick: (s: Spot) => void;
}) {
  const [view, setView] = useState<Grade | "all">(start);
  const byId = new Map(ed.entries.map((e) => [e.id, e]));
  return (
    <div className="md:hidden">
      <div role="tablist" aria-label="Grade" className="mb-4 grid grid-cols-5 gap-1 rounded-full bg-fill p-1">
        {[...GRADES, "all" as const].map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn("h-9 rounded-full text-[14px] font-semibold transition-colors", view === v ? "bg-fill-3 text-fg" : "text-muted")}
          >
            {v === "all" ? "All" : ordinal(v)}
          </button>
        ))}
      </div>

      {view === "all" ? (
        <div className="grid grid-cols-[96px_repeat(4,minmax(0,1fr))] gap-1.5">
          <div />
          {GRADES.map((g) => (
            <button key={g} type="button" onClick={() => setView(g)} className="pb-1 text-[13px] font-bold">{ordinal(g)}</button>
          ))}
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <span className={cn("ink truncate text-[12px] font-bold leading-[20px]", `subject-${row.key}`)}>{row.label}</span>
              {GRADES.map((g) => (
                <button key={g} type="button" onClick={() => setView(g)} aria-label={`${row.label}, ${ordinal(g)} grade`} className={cn("flex flex-col gap-1", `subject-${row.key}`)}>
                  {row.cells[g].entryIds.map((id) => <span key={id} className="block h-5 rounded-[6px] bg-[var(--tile-ink)] opacity-80" />)}
                  {row.cells[g].spots.map((_, i) => <span key={i} className="block h-5 rounded-[6px] shadow-[inset_0_0_0_1.5px_var(--line-strong)]" />)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <YearHead grade={view} ed={ed} settings={settings} />
          {rows.filter((r) => r.cells[view].entryIds.length + r.cells[view].spots.length > 0).map((row) => (
            <section key={row.key} aria-label={row.label} className="space-y-1.5">
              <RowHead row={row} />
              {row.cells[view].entryIds.map((id) => (
                <StaticTile key={id} entry={byId.get(id)!} result={results.get(id)} warnings={warns.get(id)} onOpen={() => onOpen(id)} />
              ))}
              {row.cells[view].spots.map((s, i) => <SpotTile key={`${s.kind}-${i}`} spot={s} editable={ed.editable} onPick={onPick} />)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Tour() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <aside aria-label="How the board works" className="soft mb-6 flex items-start justify-between gap-4 p-4">
      <ul className="space-y-1 text-[14px]">
        <li>Each row is a subject, each column a grade.</li>
        <li>Outlined spots are what you still need. Click one to fill it.</li>
        <li>Click a class to move it, mark it done, or remove it.</li>
      </ul>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Got it</Button>
    </aside>
  );
}

export function Board(props: BoardProps) {
  const { title, courses, interests, settings, prior, currentGrade, readOnly = false, notes, tour, footer } = props;
  const ed = usePlanEditor(props);
  const [openId, setOpenId] = useState<string | null>(null);
  const [add, setAdd] = useState<AddTarget | null>(null);
  const start = Math.min(12, Math.max(9, currentGrade ?? 9)) as Grade;

  const rows = useMemo(() => buildBoard(ed.entries, ed.summary, currentGrade), [ed.entries, ed.summary, currentGrade]);
  const spotCount = rows.reduce((n, r) => n + GRADES.reduce((m, g) => m + r.cells[g].spots.length, 0), 0);
  const sentence = statusSentence(ed.summary, spotCount);
  const unconfirmed = ROWS.filter((r) => r.kinds.some((k) => (ed.summary.kinds.find((x) => x.kind === k)?.provisional ?? 0) > 0));
  const openEntry = ed.entries.find((e) => e.id === openId) ?? null;
  const warns = useMemo(() => {
    const m = new Map<string, PlanWarning[]>();
    for (const w of ed.warnings) if ("entryId" in w) m.set(w.entryId, [...(m.get(w.entryId) ?? []), w]);
    return m;
  }, [ed.warnings]);
  // Shown on the page, or inside the class sheet while it is open (the page behind a modal is inert).
  const saveNotice = (ed.change && !ed.pending) || ed.error ? (
    <div className="mb-6 space-y-3">
      {ed.error && <p role="alert" className="text-[14px] text-red">{ed.error}</p>}
      {ed.change && !ed.pending && (
        <div className="soft space-y-3 bg-fill-2 p-4">
          <DraftNotice drafts={[ed.changeDraft]} />
          <p className="text-[14px] text-muted">A class change has not been confirmed. Retry checks whether it was already saved.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={ed.retry} disabled={!ed.canEdit}>Retry change</Button>
            <Button size="sm" variant="ghost" onClick={ed.discardChange}>Discard pending change</Button>
          </div>
        </div>
      )}
    </div>
  ) : null;
  const pick = (s: Spot) => setAdd({ grade: s.gradeLevel, requirement: { kind: s.kind, label: KIND_NOUN[s.kind] } });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">{title}</h1>
            {!readOnly && props.plan.status !== "DRAFT" && (
              <Badge tone={props.plan.status === "APPROVED" ? "eligible" : props.plan.status === "CHANGES_REQUESTED" ? "warning" : "review"}>
                {PLAN_STATUS_LABEL[props.plan.status]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[17px] text-muted">{sentence}</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <a href={`/plans/${props.plan.id}/print`} className="btn btn-ghost">Print</a>
          )}
          {ed.canEdit && (
            <Button variant="primary" disabled={!ed.editable} onClick={() => setAdd({ grade: start, requirement: null })}>
              Add a class
            </Button>
          )}
        </div>
      </header>

      {tour && !readOnly && <Tour />}

      {(readOnly || !ed.canEdit || notes) && (
        <ul className="mb-6 space-y-1.5 text-[14px]">
          {readOnly ? (
            <li className="text-muted">This is a student&apos;s board. You can look but not change it.</li>
          ) : props.plan.status === "SUBMITTED" ? (
            <li className="text-muted">This plan is in review, so you can look but not change it.</li>
          ) : props.plan.status === "APPROVED" ? (
            <li className="text-muted">A counselor approved this plan, so it is locked. Ask your counselor if something needs to change.</li>
          ) : null}
          {notes}
        </ul>
      )}

      {!openEntry && saveNotice}

      <Grid rows={rows} ed={ed} results={ed.results} warns={warns} settings={settings} onOpen={setOpenId} onPick={pick} />
      <PhoneBoard rows={rows} ed={ed} results={ed.results} warns={warns} settings={settings} start={start} onOpen={setOpenId} onPick={pick} />

      <p className="mt-6 max-w-[90ch] text-[13px] leading-relaxed text-muted">
        {unconfirmed.length > 0 && <>Not confirmed by a counselor yet: {unconfirmed.map((r) => r.label).join(", ")}. These classes count for now, but a counselor still has to check them. </>}
        Warnings never block your plan. The school makes the final decision.
      </p>

      {(ed.advice || footer) && (
        <div className="mt-16 grid gap-14 lg:grid-cols-2 lg:gap-16">
          {ed.advice && (
            <section aria-labelledby="college-h">
              <h2 id="college-h" className="eyebrow">For college</h2>
              <p className="mb-4 mt-1 text-[14px] leading-relaxed text-muted">
                Years of each subject colleges usually look for{ed.advice.matched.length > 0 ? `, raised for ${ed.advice.matched.join(" and ").toLowerCase()} majors` : ""}. A suggestion, not a graduation rule.
              </p>
              <ul className="soft px-4 py-2">
                {ed.advice.lines.map((l) => (
                  <li key={l.subject} className="flex items-baseline justify-between py-1.5 text-[14px]">
                    <span>{l.label}</span>
                    <span className="num"><span className={l.met ? "text-green" : "text-fg"}>{l.have}</span><span className="text-muted"> of {l.need} years</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {footer}
        </div>
      )}

      <AddCoursePanel
        open={!!add && ed.editable}
        grade={add?.grade ?? start}
        onGradeChange={(g) => setAdd((a) => (a ? { ...a, grade: g } : a))}
        onClose={() => setAdd(null)}
        courses={courses}
        inPlan={ed.inPlan}
        placements={ed.placements}
        prior={prior}
        names={ed.names}
        interests={interests}
        onAdd={(c, g) => ed.actions.add(c, g)}
        requirement={add?.requirement ?? null}
        onClearRequirement={() => setAdd((a) => (a ? { ...a, requirement: null } : a))}
      />
      <ClassSheet
        entry={openEntry}
        result={openEntry ? ed.results.get(openEntry.id) : undefined}
        warnings={openEntry ? warns.get(openEntry.id) : undefined}
        canEdit={ed.canEdit}
        busy={!ed.editable}
        canAppeal={!readOnly}
        notice={saveNotice}
        onClose={() => setOpenId(null)}
        onMove={ed.actions.move}
        onUpdate={ed.actions.update}
        onRemove={ed.actions.remove}
      />
    </div>
  );
}
