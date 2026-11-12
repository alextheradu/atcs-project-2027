"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check } from "lucide-react";
import { rowFor } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import { ELIGIBILITY_TONE, type EvalResult } from "@/lib/eligibility";
import type { PlanWarning } from "@/lib/plan-warnings";
import { gradeLabel, type EntryView } from "@/lib/plans/view";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = { eligible: "bg-green", warning: "bg-yellow", appeal: "bg-orange", locked: "bg-red", review: "bg-accent" };

export type TileFlag = { tone: "eligible" | "warning" | "appeal" | "locked" | "note"; text: string };

/**
 * The one thing worth saying on a tile, in the engine's own words so the student sees why, not just a color.
 * Finished and current classes are history, so nothing is checked or flagged on them. A missing partner class is
 * something the student fixes by adding a class, so it stays yellow even though the engine calls it appealable.
 * A `note` is what a person still decides (a recommendation): information in muted text, never a warning.
 */
export function tileFlag(entry: EntryView, result?: EvalResult, warnings: PlanWarning[] = []): TileFlag | null {
  if (entry.status !== "PLANNED") return null;
  if (result?.viaAppeal) return { tone: "eligible", text: "Approved by placement review" };
  if (warnings.some((w) => w.code === "MISSING_COREQ")) return { tone: "warning", text: "Needs its partner class" };
  if (result && result.status !== "ELIGIBLE") return { tone: ELIGIBILITY_TONE[result.status], text: result.summary };
  if (entry.gradesOffered.length > 0 && !entry.gradesOffered.includes(entry.gradeLevel)) {
    return { tone: "warning", text: `Not offered in ${entry.gradeLevel}th grade` };
  }
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
      <span className="line-clamp-2 block">{entry.name}</span>
      <span className="ink mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium">
        <span className="num">{formatCredits(entry.credits)} cr</span>
        {status && <span className="inline-flex items-center gap-1">{entry.status === "COMPLETED" && <Check aria-hidden size={12} strokeWidth={3} />}{status}</span>}
      </span>
      {flag && flag.tone === "note" && <span className="mt-1 line-clamp-2 block text-xs text-muted">{flag.text}</span>}
      {flag && flag.tone !== "note" && (
        <span className="mt-1 flex items-start gap-1.5 text-xs font-medium text-fg">
          <span aria-hidden className={cn("mt-[4px] size-2 shrink-0 rounded-full", DOT[flag.tone])} />
          <span className="line-clamp-2">{flag.text}</span>
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
