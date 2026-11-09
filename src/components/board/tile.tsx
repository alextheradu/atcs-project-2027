"use client";

import { useDraggable } from "@dnd-kit/core";
import { rowFor } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import { ELIGIBILITY_TONE, eligibilityLabel, type EvalResult } from "@/lib/eligibility";
import type { PlanWarning } from "@/lib/plan-warnings";
import { gradeLabel, type EntryView } from "@/lib/plans/view";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { eligible: "bg-green", warning: "bg-yellow", appeal: "bg-orange", locked: "bg-red", review: "bg-accent" };

/**
 * The one problem worth showing on a tile, in words. A missing partner class first (its eligibility label would
 * read as locked, which is not the real problem), then eligibility, then a grade the class is not offered in.
 */
export function tileFlag(entry: EntryView, result?: EvalResult, warnings: PlanWarning[] = []): { tone: string; text: string } | null {
  if (warnings.some((w) => w.code === "MISSING_COREQ")) return { tone: "warning", text: "Needs its partner class" };
  if (result && result.viaAppeal) return { tone: "eligible", text: "Approved via appeal" };
  if (result && result.status !== "ELIGIBLE") return { tone: ELIGIBILITY_TONE[result.status], text: eligibilityLabel(result) };
  if (entry.gradesOffered.length > 0 && !entry.gradesOffered.includes(entry.gradeLevel)) {
    return { tone: "warning", text: `Not offered in ${entry.gradeLevel}th` };
  }
  return null;
}

function statusText(e: EntryView): string | null {
  if (e.status === "COMPLETED") return gradeLabel(e.grade) ? `Done, ${gradeLabel(e.grade)}` : "Done";
  if (e.status === "IN_PROGRESS") return "Taking now";
  return null;
}

export function TileBody({ entry, result, warnings }: { entry: EntryView; result?: EvalResult; warnings?: PlanWarning[] }) {
  const flag = tileFlag(entry, result, warnings);
  const status = statusText(entry);
  return (
    <>
      <span className="line-clamp-2 block">{entry.name}</span>
      <span className="ink mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-medium">
        <span className="num">{formatCredits(entry.credits)} cr</span>
        {status && <span>{status}</span>}
      </span>
      {flag && (
        <span className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-fg">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[flag.tone])} />
          {flag.text}
        </span>
      )}
    </>
  );
}

const subjectClass = (e: EntryView) => `subject-${rowFor(e.tags)}`;

/** What a screen reader hears: the same facts the tile shows, then what clicking does. */
function tileLabel(entry: EntryView, result?: EvalResult, warnings?: PlanWarning[]): string {
  const status = statusText(entry);
  const flag = tileFlag(entry, result, warnings);
  return `${entry.name}, ${formatCredits(entry.credits)} credits${status ? `, ${status}` : ""}${flag ? `. ${flag.text}` : ""}. Open options.`;
}

/** A class on the Board. Click to open its sheet; drag (pointer or touch) to another grade. */
export function DraggableTile({ entry, result, warnings, disabled, onOpen }: { entry: EntryView; result?: EvalResult; warnings?: PlanWarning[]; disabled: boolean; onOpen: () => void }) {
  const pending = entry.id.startsWith("tmp-");
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id, disabled: disabled || pending });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      disabled={pending}
      aria-label={tileLabel(entry, result, warnings)}
      className={cn("tile touch-manipulation", subjectClass(entry), isDragging && "opacity-30", pending && "opacity-60")}
      {...listeners}
    >
      <TileBody entry={entry} result={result} warnings={warnings} />
    </button>
  );
}

/** Same tile without drag, for the phone layout and read-only views. */
export function StaticTile({ entry, result, warnings, onOpen }: { entry: EntryView; result?: EvalResult; warnings?: PlanWarning[]; onOpen?: () => void }) {
  const cls = cn("tile", subjectClass(entry));
  if (!onOpen) return <div className={cls}><TileBody entry={entry} result={result} warnings={warnings} /></div>;
  return (
    <button type="button" onClick={onOpen} className={cls} aria-label={tileLabel(entry, result, warnings)}>
      <TileBody entry={entry} result={result} warnings={warnings} />
    </button>
  );
}

/** The floating copy that follows the pointer while dragging. */
export function DragGhost({ entry }: { entry: EntryView }) {
  return (
    <div className={cn("tile w-[200px] shadow-[0_12px_32px_rgb(0_0_0/0.5)]", subjectClass(entry))}>
      <TileBody entry={entry} />
    </div>
  );
}
