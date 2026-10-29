"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clonePlan, deletePlan, renamePlan, setPrimaryPlan } from "@/lib/plans/actions";

export function PlanActions({ planId, name, isPrimary, editable }: { planId: string; name: string; isPrimary: boolean; editable: boolean }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; data?: { id: string } }>, then?: (r: { ok: true; data?: { id: string } }) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError("error" in r ? (r.error ?? "That did not work.") : "That did not work.");
      else then?.(r as { ok: true; data?: { id: string } });
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renamePlan(planId, value), () => setRenaming(false));
            }}
          >
            <input className="input !w-44" value={value} maxLength={60} autoFocus aria-label="Plan name" onChange={(e) => setValue(e.target.value)} />
            <Button size="sm" variant="primary" type="submit" disabled={pending}>Save</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setRenaming(false); setValue(name); }}>Cancel</Button>
          </form>
        ) : (
          <>
            {editable && <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>Rename</Button>}
            {!isPrimary && <Button size="sm" disabled={pending} onClick={() => run(() => setPrimaryPlan(planId), () => router.refresh())}>Make primary</Button>}
            <Button size="sm" disabled={pending} onClick={() => run(() => clonePlan(planId), (r) => r.data && router.push(`/plans/${r.data.id}`))}>Duplicate</Button>
            {confirming ? (
              <>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deletePlan(planId), () => router.push("/plans"))}>Delete for good</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep it</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted" onClick={() => setConfirming(true)}>Delete</Button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
    </div>
  );
}
