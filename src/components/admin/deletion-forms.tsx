"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { adminCancelDeletion, adminDeleteUser, recordGuardianRequest } from "@/lib/deletion/actions";

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

/** Deletes an account now. Opens a confirm step where the admin types the account's email. */
export function DeleteUserButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  if (!open) return <Button size="sm" variant="ghost" className="text-red" onClick={() => setOpen(true)}>Delete</Button>;
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await adminDeleteUser({ userId, confirmEmail: typed });
            setErr(r.ok ? null : r.error);
          } catch { setErr(SAVE_INTERRUPTED); }
        });
      }}
    >
      <p className="w-full text-[13px] text-muted">This erases the account and everything in it now. It cannot be undone. Type <span className="num text-fg">{email}</span> to confirm.</p>
      <input className="input !h-8 !w-72" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={`Type ${email} to confirm`} autoComplete="off" spellCheck={false} maxLength={254} autoFocus />
      <Button type="submit" size="sm" variant="danger" disabled={pending || !matches}>Delete permanently</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setOpen(false); setTyped(""); setErr(null); }}>Keep account</Button>
      {err && <span role="alert" className="text-xs text-red">{err}</span>}
    </form>
  );
}
