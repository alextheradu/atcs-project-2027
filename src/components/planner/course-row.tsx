"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { DraftNotice, useDraftState } from "@/components/draft-state";
import { Breakdown } from "@/components/eligibility/breakdown";
import { EligibilityBadge } from "@/components/eligibility/status-badge";
import { Button } from "@/components/ui/button";
import type { EvalResult } from "@/lib/eligibility";
import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/credits";
import { LEVEL_LABEL, DEPT_LABEL } from "@/lib/catalog/labels";
import { ENTRY_STATUSES } from "@/lib/plans/schemas";
import { GRADE_OPTIONS, STATUS_LABEL, gradeLabel, type EntryView } from "@/lib/plans/view";

export interface RowActions {
  onUpdate: (id: string, patch: { status?: EntryView["status"]; grade?: string | null; credits?: number }) => void;
  onMove: (id: string, grade: number) => void;
  onRemove: (id: string) => void;
}

function Grip() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden fill="currentColor">
      {[2, 7, 12].flatMap((y) => [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />))}
    </svg>
  );
}

export function RowBody({ entry, offered, result }: { entry: EntryView; offered: boolean; result?: EvalResult }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{entry.name}</span>
          {!offered && <span title="Not offered in this grade" className="size-1.5 shrink-0 rounded-full bg-yellow" />}
          {result && (result.status !== "ELIGIBLE" || result.viaAppeal) && <EligibilityBadge result={result} className="shrink-0" />}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {DEPT_LABEL[entry.department]} · {LEVEL_LABEL[entry.level]}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="num block text-fg">{formatCredits(entry.credits)}</span>
        {entry.status !== "PLANNED" && (
          <span className="num block text-muted">{entry.status === "COMPLETED" ? gradeLabel(entry.grade) || "done" : "now"}</span>
        )}
      </span>
    </>
  );
}

export function CourseRow({ entry, editable, actions, result }: { entry: EntryView; editable: boolean; actions: RowActions; result?: EvalResult }) {
  const [open, setOpen] = useState(false);
  const [creditText, setCreditText, creditDraft] = useDraftState(`entry:${entry.id}:credits`, String(entry.credits));
  const { dirty, commit } = creditDraft;
  useEffect(() => {
    if (dirty && creditText === String(entry.credits)) commit(creditText);
  }, [dirty, creditText, entry.credits, commit]);
  const pending = entry.id.startsWith("tmp-");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id, disabled: !editable || pending });
  const offered = entry.gradesOffered.length === 0 || entry.gradesOffered.includes(entry.gradeLevel);

  return (
    <li ref={setNodeRef} className={cn("transition-opacity duration-150", isDragging && "opacity-30", pending && "opacity-60")}>
      <div className="flex items-center gap-1">
        {editable && (
          <button
            type="button"
            aria-label={`Drag ${entry.name}`}
            className="grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted/60 transition-colors hover:text-fg active:cursor-grabbing"
            {...listeners}
            {...attributes}
          >
            <Grip />
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-2 pr-1 text-left"
        >
          <RowBody entry={entry} offered={offered} result={result} />
        </button>
      </div>

      {(open || creditDraft.dirty) && (
        <div className="mb-3 ml-7 grid gap-3 border-t border-line pt-3 text-[13px] sm:grid-cols-2">
          {result && result.tree && (
            <div className="sm:col-span-2">
              <h3 className="text-xs font-medium text-muted">Requirements for this course</h3>
              <Breakdown tree={result.tree} />
            </div>
          )}
          {result && !result.tree && result.status === "ELIGIBLE_WITH_WARNING" && entry.prereqText && (
            <p className="text-muted sm:col-span-2">{entry.prereqText}</p>
          )}
          {editable ? (
            <>
              <DraftNotice drafts={[creditDraft]} />
              <label className="space-y-1">
                <span className="text-muted">Status</span>
                <select
                  className="input"
                  value={entry.status}
                  disabled={pending}
                  onChange={(e) => actions.onUpdate(entry.id, { status: e.target.value as EntryView["status"] })}
                >
                  {ENTRY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Grade</span>
                <select
                  className="input"
                  value={entry.grade ?? ""}
                  disabled={pending || entry.status !== "COMPLETED"}
                  onChange={(e) => actions.onUpdate(entry.id, { grade: e.target.value || null })}
                >
                  <option value="">{entry.status === "COMPLETED" ? "No grade" : "Not completed"}</option>
                  {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-muted">Credits counted</span>
                <input
                  className="input num"
                  type="number"
                  step="0.5"
                  min={0}
                  max={30}
                  value={creditText}
                  onChange={(e) => setCreditText(e.target.value)}
                  disabled={pending}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== entry.credits) actions.onUpdate(entry.id, { credits: v });
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted">Move to grade</span>
                <select className="input" value={entry.gradeLevel} disabled={pending} onChange={(e) => actions.onMove(entry.id, Number(e.target.value))}>
                  {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </label>
              <div className="flex items-center justify-between sm:col-span-2">
                <Link href={`/courses/${entry.slug}`} className="text-muted underline-offset-4 transition-colors hover:text-fg hover:underline">
                  View course
                </Link>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => actions.onRemove(entry.id)}>
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <Link href={`/courses/${entry.slug}`} className="text-muted underline-offset-4 hover:text-fg hover:underline sm:col-span-2">
              View course
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
