"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { createPlan } from "@/lib/plans/actions";

export function NewPlanForm({ label = "New plan", first = false }: { label?: string; first?: boolean }) {
  const router = useRouter();
  const [name, setName, draft] = useDraftState("plan:new", "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          try {
            const r = await createPlan(name.trim() === "" ? undefined : name);
            if (r.ok && r.data) { draft.commit(name, ""); router.push(`/plans/${r.data.id}`); }
            else if (!r.ok) setError(r.error);
          } catch { setError(SAVE_INTERRUPTED); }
        });
      }}
    >
      <DraftNotice drafts={[draft]} />
      {!first && <input className="input !w-44" value={name} maxLength={60} placeholder="Name (optional)" aria-label="Plan name" onChange={(e) => setName(e.target.value)} />}
      <Button type="submit" variant="primary" size="sm" disabled={pending}>{label}</Button>
      {error && <span role="alert" className="text-[13px] text-red">{error}</span>}
    </form>
  );
}
