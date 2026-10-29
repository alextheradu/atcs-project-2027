"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startAppeal } from "@/lib/appeals/actions";

/** Opens (or reopens) the draft for a course, then goes to the form. */
export function StartAppealButton({ slug, className = "btn btn-sm" }: { slug: string; className?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={pending} onClick={() => { setError(null); start(async () => { const r = await startAppeal(slug); if (r.ok && r.data) router.push(`/appeals/${r.data.id}`); else if (!r.ok) setError(r.error); }); }}>
        {pending ? "Opening" : "Request placement review"}
      </button>
      {error && <span role="alert" className="text-xs text-red">{error}</span>}
    </span>
  );
}
