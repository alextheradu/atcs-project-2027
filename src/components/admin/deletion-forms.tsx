"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { adminCancelDeletion, recordGuardianRequest } from "@/lib/deletion/actions";

export function GuardianForm() {
  const [email, setEmail, draft] = useDraftState("admin:guardian-deletion", "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await recordGuardianRequest(email);
            if (r.ok) draft.commit(email, "");
            setMsg(r.ok ? { ok: true, text: "Recorded. The student is told, and deletion runs in 14 days." } : { ok: false, text: r.error });
          } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED }); }
        });
      }}
    >
      <DraftNotice drafts={[draft]} />
      <input className="input !w-72" type="email" placeholder="student account email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Student account email" required maxLength={254} />
      <Button type="submit" variant="danger" disabled={pending}>Record request</Button>
      {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-green" : "text-sm text-red"}>{msg.text}</span>}
    </form>
  );
}

export function CancelDeletionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {err && <span role="alert" className="text-xs text-red">{err}</span>}
      <Button size="sm" disabled={pending} onClick={() => start(async () => {
        try {
          const r = await adminCancelDeletion(id);
          setErr(r.ok ? null : r.error);
        } catch { setErr(SAVE_INTERRUPTED); }
      })}>Cancel</Button>
    </span>
  );
}
