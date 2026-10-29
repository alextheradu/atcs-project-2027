"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { decideAppeal, startReview } from "@/lib/appeals/actions";

export function DecisionForm({ appealId, status }: { appealId: string; status: string }) {
  const router = useRouter();
  const [note, setNote, draft] = useDraftState(`appeal:${appealId}:decision`, "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); start(async () => { try { const r = await fn(); if (r.ok) router.refresh(); else setError(r.error ?? "That did not work."); } catch { setError(SAVE_INTERRUPTED); } }); };
  return (
    <div className="space-y-3">
      <DraftNotice drafts={[draft]} />
      {status === "SUBMITTED" && <Button size="sm" disabled={pending} onClick={() => run(() => startReview(appealId))}>Mark as under review</Button>}
      <label className="block space-y-1 text-[13px]">
        <span className="text-muted">Decision note (the student reads this)</span>
        <textarea className="input" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" disabled={pending || note.trim().length < 3} onClick={() => run(async () => { const r = await decideAppeal({ appealId, decision: "APPROVED", note }); if (r.ok) draft.commit(note); return r; })}>Approve</Button>
        <Button variant="danger" disabled={pending || note.trim().length < 3} onClick={() => run(async () => { const r = await decideAppeal({ appealId, decision: "DENIED", note }); if (r.ok) draft.commit(note); return r; })}>Deny</Button>
      </div>
    </div>
  );
}
