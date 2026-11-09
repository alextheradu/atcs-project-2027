"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SAVE_INTERRUPTED } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { createPlan } from "@/lib/plans/actions";

/** Creates the student's one plan. The first plan a student makes is their primary plan. */
export function StartBoard() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await createPlan();
              if (r.ok) router.refresh();
              else setError(r.error);
            } catch { setError(SAVE_INTERRUPTED); }
          })
        }
      >
        Start your board
      </Button>
      {error && <p role="alert" className="text-[14px] text-red">{error}</p>}
    </div>
  );
}
