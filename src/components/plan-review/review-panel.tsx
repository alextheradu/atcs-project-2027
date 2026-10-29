"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { addComment, approvePlan, reopenPlan, requestPlanChanges, submitPlan, withdrawPlan } from "@/lib/plan-review/actions";

export interface CommentView {
  id: string;
  author: string;
  authorRole: string;
  body: string;
  when: string;
  entryName: string | null;
}

interface Props {
  planId: string;
  status: "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED";
  /** The plan's owner is looking. */
  isOwner: boolean;
  /** A counselor or admin is looking. */
  canReview: boolean;
  comments: CommentView[];
  entries: { id: string; name: string }[];
}

const ROLE: Record<string, string> = { DELETED: "former account", COUNSELOR: "Counselor", ADMIN: "Admin", STUDENT: "Student", INCOMING: "Student", SUPERVISOR: "Supervisor" };

export function ReviewPanel({ planId, status, isOwner, canReview, comments, entries }: Props) {
  const router = useRouter();
  const [text, setText, textDraft] = useDraftState(`review:${planId}:comment`, "");
  const [target, setTarget, targetDraft] = useDraftState(`review:${planId}:target`, "");
  const [note, setNote, noteDraft] = useDraftState(`review:${planId}:note`, "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { after?.(); router.refresh(); } else setError(r.error ?? "That did not work.");
      } catch { setError(SAVE_INTERRUPTED); }
    });
  };

  return (
    <section aria-label="Review" className="mt-14 max-w-[760px] space-y-6 border-t border-line pt-8">
      <h2 className="text-sm font-medium">Review</h2>

      {isOwner && (
        <div className="flex flex-wrap items-center gap-3">
          {(status === "DRAFT" || status === "CHANGES_REQUESTED") && (
            <>
              <Button variant="primary" disabled={pending} onClick={() => run(() => submitPlan(planId))}>{status === "CHANGES_REQUESTED" ? "Send again for review" : "Send for review"}</Button>
              <span className="text-[13px] text-muted">A counselor will look it over. The plan is read-only while it is in review.</span>
            </>
          )}
          {status === "SUBMITTED" && (
            <>
              <Button disabled={pending} onClick={() => run(() => withdrawPlan(planId))}>Take it back to edit</Button>
              <span className="text-[13px] text-muted">Waiting for a counselor.</span>
            </>
          )}
          {status === "APPROVED" && (
            <>
              <Button disabled={pending} onClick={() => run(() => reopenPlan(planId))}>Reopen to make changes</Button>
              <span className="text-[13px] text-muted">Reopening clears the approval.</span>
            </>
          )}
        </div>
      )}

      {canReview && status === "SUBMITTED" && (
        <div className="space-y-2.5 border-y border-line py-4">
          <label className="block space-y-1 text-[13px]">
            <span className="text-muted">Note to the student (needed if you ask for changes)</span>
            <textarea className="input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button variant="primary" disabled={pending} onClick={() => run(() => approvePlan(planId, note), () => noteDraft.commit(note, ""))}>Approve</Button>
            <Button disabled={pending || note.trim().length === 0} onClick={() => run(() => requestPlanChanges(planId, note), () => noteDraft.commit(note, ""))}>Request changes</Button>
          </div>
        </div>
      )}

      <ul className="list">
        {comments.map((c) => (
          <li key={c.id} className="py-3">
            <p className="text-xs text-muted">
              <span className="text-fg">{c.author}</span> · {ROLE[c.authorRole] ?? c.authorRole} · <span className="num">{c.when}</span>
              {c.entryName && <> · on {c.entryName}</>}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px]">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && <li className="py-3 text-[13px] text-muted">No comments yet.</li>}
      </ul>

      {(isOwner || canReview) && (
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          <label className="sr-only" htmlFor="c-target">About</label>
          <select id="c-target" className="input !w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">The whole plan</option>
            {entries.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <textarea className="input" rows={3} maxLength={1000} placeholder="Write a comment" aria-label="Comment" value={text} onChange={(e) => setText(e.target.value)} />
          <Button disabled={pending || text.trim().length === 0} onClick={() => run(() => addComment({ planId, entryId: target || null, body: text }), () => { textDraft.commit(text, ""); targetDraft.commit(target); })}>Add comment</Button>
        </form>
      )}
      <DraftNotice drafts={[textDraft, targetDraft, noteDraft]} />
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
    </section>
  );
}
