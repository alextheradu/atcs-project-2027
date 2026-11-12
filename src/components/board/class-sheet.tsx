"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { StartAppealButton } from "@/components/appeals/start-button";
import { DraftNotice, useDraftState } from "@/components/draft-state";
import { Breakdown } from "@/components/eligibility/breakdown";
import { Button } from "@/components/ui/button";
import { ROWS, rowFor } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import type { EvalResult } from "@/lib/eligibility";
import { describeWarning, type PlanWarning } from "@/lib/plan-warnings";
import { ENTRY_STATUSES } from "@/lib/plans/schemas";
import { GRADE_OPTIONS, STATUS_LABEL, type EntryView } from "@/lib/plans/view";
import { cn } from "@/lib/utils";
import { tileFlag } from "./tile";
import type { EntryPatch } from "./use-plan-editor";

interface Props {
  entry: EntryView | null;
  result?: EvalResult;
  warnings?: PlanWarning[];
  /** The owner may change this plan (not read-only, not in review). */
  canEdit: boolean;
  /** A save is in flight or waiting for a retry, so new changes wait. Controls stay mounted to keep focus. */
  busy: boolean;
  /** Only the student whose board this is can ask for a placement review. */
  canAppeal: boolean;
  /** Save problems shown inside the sheet, since the page behind the modal is inert. */
  notice?: React.ReactNode;
  onClose: () => void;
  onMove: (id: string, grade: number) => void;
  onUpdate: (id: string, patch: EntryPatch) => void;
  onRemove: (id: string) => void;
}

/** Credits are typed, so they keep a draft until the server has the same number. */
function CreditsField({ entry, disabled, onSave }: { entry: EntryView; disabled: boolean; onSave: (credits: number) => void }) {
  const [text, setText, draft] = useDraftState(`entry:${entry.id}:credits`, String(entry.credits));
  const { dirty, commit } = draft;
  useEffect(() => {
    if (dirty && text === String(entry.credits)) commit(text);
  }, [dirty, text, entry.credits, commit]);
  // Credits come from the Program of Studies or the transcript, so changing them is a deliberate step.
  const [editing, setEditing] = useState(dirty);
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted">Credits counted: </span><span className="num font-medium">{formatCredits(entry.credits)}</span>
        </p>
        {!disabled && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Change</Button>}
      </div>
    );
  }
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">Credits counted</span>
      <span className="block text-[13px] text-muted">Only change this if your transcript shows a different number.</span>
      <DraftNotice drafts={[draft]} />
      <input
        className="input num bg-fill-2"
        type="number"
        step="0.5"
        min={0}
        max={30}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v !== entry.credits) onSave(v);
        }}
      />
    </label>
  );
}

const SHEET_DOT: Record<string, string> = { eligible: "bg-green", warning: "bg-yellow", appeal: "bg-orange", locked: "bg-red" };
const SHEET_HEADING: Record<string, string> = {
  eligible: "Approved by placement review",
  warning: "Check this first",
  appeal: "Needs a placement review",
  locked: "Missing a prerequisite",
};

/** The full rule from the Program of Studies, folded away: the sentence above already says what matters. */
function FullRule({ tree }: { tree: NonNullable<EvalResult["tree"]> }) {
  return (
    <details className="group pt-1">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-accent-ink hover:underline [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show the full rule</span>
        <span className="hidden group-open:inline">Hide the full rule</span>
      </summary>
      <div className="mt-2"><Breakdown tree={tree} /></div>
    </details>
  );
}

/** Everything you can do with one class on the Board. Moving by grade buttons is the keyboard way to drag. */
export function ClassSheet({ entry, result, warnings = [], canEdit, busy, canAppeal, notice, onClose, onMove, onUpdate, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<EntryView | null>(entry);
  if (entry && entry !== shown) setShown(entry);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (entry && !d.open) d.showModal();
    if (!entry && d.open) d.close();
  }, [entry]);

  const e = entry ?? shown;
  const row = e ? ROWS.find((r) => r.key === rowFor(e.tags))! : null;
  const flag = e ? tileFlag(e, result, warnings) : null;
  const coreq = warnings.filter((w) => w.code === "MISSING_COREQ");
  // A review is only for a class the student is close to qualifying for, not for warnings or a missing partner class.
  // A recommendation or audition the student may not get is also a reason to ask, so a class with notes qualifies too.
  const askable = canAppeal && !!e && e.status === "PLANNED" && !!result && !result.viaAppeal && coreq.length === 0;
  const canAsk = askable && result!.status === "NOT_ELIGIBLE_APPEALABLE";
  const canAskWithNote = askable && result!.status === "ELIGIBLE" && result!.notes.length > 0;
  // The profile is under Settings; say where instead of sending the student looking for it.
  const needsProfile = !!result?.leaves.some((l) => l.rule.type === "priorCoursework" && l.state === "pending");
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (confirmRemove && entry && shown && entry.id !== shown.id) setConfirmRemove(false);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(ev) => ev.target === ref.current && onClose()}
      aria-label={e ? e.name : "Class"}
      className="m-0 mt-auto h-auto max-h-[88dvh] w-full max-w-none rounded-t-[20px] bg-fill p-0 text-fg backdrop:bg-black/60 md:ml-auto md:mt-0 md:h-dvh md:max-h-dvh md:max-w-[440px] md:rounded-none md:rounded-l-[20px]"
    >
      {e && row && (
        <div className="flex h-full flex-col">
          <header className={cn("flex items-start justify-between gap-3 px-6 pb-4 pt-6", `subject-${row.key}`)}>
            <div className="min-w-0">
              <p className="ink text-[13px] font-semibold">{row.label}</p>
              <h2 className="mt-0.5 text-[20px] font-bold leading-tight tracking-[-0.02em]">{e.name}</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="num">{formatCredits(e.credits)}</span> credits, {e.gradeLevel}th grade
                {e.status === "COMPLETED" && ", done"}
                {e.status === "IN_PROGRESS" && ", taking now"}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X size={18} /></Button>
          </header>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 pb-8">
            {notice}
            {busy && !notice && <p role="status" className="text-sm text-muted">Saving...</p>}
            {flag && flag.tone !== "note" && (
              <div className="soft space-y-2 bg-fill-2 p-4">
                <p className="flex items-start gap-2 text-[15px] font-semibold">
                  <span aria-hidden className={cn("mt-[7px] size-2 shrink-0 rounded-full", SHEET_DOT[flag.tone])} />
                  {SHEET_HEADING[flag.tone]}
                </p>
                {coreq.length > 0
                  ? coreq.map((w, i) => <p key={i} className="text-sm text-muted">{describeWarning(w)}</p>)
                  : <p className="text-sm text-muted">{flag.text}</p>}
                {needsProfile && (
                  <p className="text-sm"><Link href="/settings" className="font-medium text-accent-ink hover:underline">Add your 8th grade math in Settings</Link></p>
                )}
                {canAsk && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[13px] text-muted">You are close. A placement review asks the department to look at your record.</p>
                    <StartAppealButton slug={e.slug} className="btn btn-sm !bg-fill-3" />
                  </div>
                )}
                {result?.tree && <FullRule tree={result.tree} />}
              </div>
            )}
            {result?.notes[0] && e.status === "PLANNED" && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Also decided by the school</p>
                {result.notes.map((n) => <p key={n} className="text-sm text-muted">{n}</p>)}
                {canAskWithNote && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[13px] text-muted">If you do not get it, you can ask the department to look at your record.</p>
                    <StartAppealButton slug={e.slug} className="btn btn-sm" />
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <section className="space-y-2">
                <h3 className="text-sm text-muted">Move to</h3>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Move to grade">
                  {[9, 10, 11, 12].map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={g === e.gradeLevel}
                      aria-disabled={busy || undefined}
                      onClick={() => !busy && g !== e.gradeLevel && onMove(e.id, g)}
                      className={cn(
                        "h-11 rounded-[12px] text-[15px] font-semibold transition-colors",
                        g === e.gradeLevel ? "bg-accent text-white" : "bg-fill-2 text-fg hover:bg-fill-3",
                      )}
                    >
                      {g}th
                    </button>
                  ))}
                </div>
              </section>
            )}

            {canEdit && (
              <section className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm text-muted">Status</span>
                  <select className="input bg-fill-2" value={e.status} onChange={(ev) => !busy && onUpdate(e.id, { status: ev.target.value as EntryView["status"] })}>
                    {ENTRY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm text-muted">Grade you got</span>
                  <select className="input bg-fill-2" value={e.grade ?? ""} disabled={e.status !== "COMPLETED"} onChange={(ev) => !busy && onUpdate(e.id, { grade: ev.target.value || null })}>
                    <option value="">{e.status === "COMPLETED" ? "No grade" : "Not finished yet"}</option>
                    {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <CreditsField key={e.id} entry={e} disabled={false} onSave={(c) => !busy && onUpdate(e.id, { credits: c })} />
                </div>
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link href={`/courses/${e.slug}`} className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
                About this class
              </Link>
              {canEdit && !confirmRemove && (
                <Button variant="danger" size="sm" aria-disabled={busy || undefined} onClick={() => !busy && setConfirmRemove(true)}>
                  Remove from board
                </Button>
              )}
              {canEdit && confirmRemove && (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-muted">Remove {e.name}?</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>Keep</Button>
                  <Button variant="danger" size="sm" aria-disabled={busy || undefined} onClick={() => { if (busy) return; setConfirmRemove(false); onRemove(e.id); onClose(); }}>
                    Remove
                  </Button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
