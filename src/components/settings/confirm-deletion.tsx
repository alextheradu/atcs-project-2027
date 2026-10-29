"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { SAVE_INTERRUPTED } from "@/components/draft-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { confirmDeletion } from "@/lib/deletion/actions";

export function ConfirmDeletion({ token, days }: { token: string; days: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // On success the action refreshes the page, which then shows the scheduled notice.
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const r = await confirmDeletion(token);
                setError(r.ok ? null : r.error);
              } catch {
                setError(SAVE_INTERRUPTED);
              }
            })
          }
        >
          Yes, delete my data in {days} days
        </Button>
        <Link href="/settings" className={buttonVariants()}>Not now</Link>
      </div>
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
    </div>
  );
}
