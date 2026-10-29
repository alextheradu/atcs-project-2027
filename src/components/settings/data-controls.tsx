"use client";

import { useState, useTransition } from "react";
import { SAVE_INTERRUPTED } from "@/components/draft-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cancelDeletion, requestDeletion } from "@/lib/deletion/actions";

export interface OpenDeletion {
  status: "AWAITING_CONFIRMATION" | "SCHEDULED";
  source: "self" | "guardian";
  /** Formatted on the server so the date reads the same everywhere. */
  scheduledOn: string | null;
}

export function DataControls({ open }: { open: OpenDeletion | null }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error });
      } catch {
        setMsg({ ok: false, text: SAVE_INTERRUPTED });
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Download my data</h3>
        <p className="max-w-[65ch] text-[13px] text-muted">A JSON file with everything this site stores about you: your profile, plans, placement reviews, messages and settings. Sign-in tokens and push keys are left out.</p>
        <a href="/api/export" download className={buttonVariants({ size: "sm" })}>Download JSON</a>
      </div>

      <div className="space-y-2 border-t border-line pt-6">
        <h3 className="text-sm font-medium">Delete my data</h3>
        {!open && (
          <>
            <p className="max-w-[65ch] text-[13px] text-muted">
              Deletes your account, plans, placement reviews, linked emails and push devices. We email you a link to confirm. Deletion happens 14 days after you confirm, and you can cancel until then. Download your data first if you want a copy.
            </p>
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(requestDeletion, "Check your notifications and email for the confirmation link. It works for 24 hours.")}>Delete my data</Button>
          </>
        )}
        {open?.status === "AWAITING_CONFIRMATION" && (
          <>
            <p className="max-w-[65ch] text-[13px] text-muted">We sent a confirmation link to your email and to your notifications. Nothing is deleted until you open it and confirm.</p>
            <Button size="sm" disabled={pending} onClick={() => run(cancelDeletion, "Request cancelled.")}>Cancel the request</Button>
          </>
        )}
        {open?.status === "SCHEDULED" && (
          <>
            <p className="max-w-[65ch] text-[13px]">
              Your data will be deleted on <span className="num">{open.scheduledOn}</span>. {open.source === "guardian" ? "A parent or guardian asked for this. Only an admin can cancel it." : "You can cancel until then."}
            </p>
            {open.source === "self" && <Button size="sm" disabled={pending} onClick={() => run(cancelDeletion, "Deletion cancelled. Your account stays.")}>Cancel deletion</Button>}
          </>
        )}
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{msg.text}</p>}
      </div>
    </div>
  );
}
