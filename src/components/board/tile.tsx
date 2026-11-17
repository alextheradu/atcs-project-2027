"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check } from "lucide-react";
import { rowFor } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import { PARTNER_LABEL, displayStatus, type EvalResult } from "@/lib/eligibility";
import type { PlanWarning } from "@/lib/plan-warnings";
import { gradeLabel, type EntryView } from "@/lib/plans/view";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { eligible: "bg-green", warning: "bg-yellow", appeal: "bg-orange", locked: "bg-red", review: "bg-accent" };

export type TileFlag = { tone: "eligible" | "warning" | "appeal" | "locked" | "note"; text: string; reason?: string };

/**
 * The one thing worth saying on a tile: the shared status label (the same words the sheet, badges and class page use)
 * and the reason in the engine's own words. Finished and current classes are history, so nothing is flagged on them.
 * A `note` is information in gray, never a warning: something to add (a grade) or something the school decides.
 */
export function tileFlag(entry: EntryView, result?: EvalResult, warnings: PlanWarning[] = []): TileFlag | null {
  if (entry.status !== "PLANNED") return null;
  if (result?.viaAppeal) return { tone: "eligible", text: displayStatus(result).label };
  if (warnings.some((w) => w.code === "MISSING_COREQ")) return { tone: "warning", text: PARTNER_LABEL, reason: result?.summary };
  if (result && result.status !== "ELIGIBLE") {
    const s = displayStatus(result);
    return { tone: s.tone, text: s.label, reason: result.summary };
  }
  if (entry.gradesOffered.length > 0 && !entry.gradesOffered.includes(entry.gradeLevel)) {
    return { tone: "warning", text: `Not offered in ${entry.gradeLevel}th grade` };
  }
  if (result?.missing[0]) return { tone: "note", text: result.missing[0] };
  if (result?.notes[0]) return { tone: "note", text: result.notes[0] };
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
      <span className="line-clamp-2">{entry.name}</span>
      <span className="ink mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium">
        <span className="num">{formatCredits(entry.credits)} cr</span>
        {status && <span className="inline-flex items-center gap-1">{entry.status === "COMPLETED" && <Check aria-hidden size={12} strokeWidth={3} />}{status}</span>}
      </span>
      {flag && flag.tone === "note" && <span className="mt-1 line-clamp-2 text-xs text-muted">{flag.text}</span>}
      {flag && flag.tone !== "note" && (
        <span className="mt-1 block text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-fg">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[flag.tone])} />
            {flag.text}
          </span>
          {flag.reason && <span className="mt-0.5 line-clamp-2 text-muted">{flag.reason}</span>}
        </span>
      )}
    </>
  );
}

const subjectClass = (e: EntryView) => cn(`subject-${rowFor(e.tags)}`, e.status === "COMPLETED" && "tile-done");

/** What a screen reader hears: the same facts the tile shows, then what clicking does. */
function tileLabel(entry: EntryView, result?: EvalResult, warnings?: PlanWarning[]): string {
  const status = statusText(entry);
  const flag = tileFlag(entry, result, warnings);
  return `${entry.name}, ${formatCredits(entry.credits)} credits${status ? `, ${status}` : ""}${flag ? `. ${flag.text}${flag.reason ? `. ${flag.reason}` : ""}` : ""}. Open options.`;
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
