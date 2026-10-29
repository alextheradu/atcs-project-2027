"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveImportRequest, dismissImportRequest } from "@/lib/transcript/requests";

export function RequestRow({ id, title, count, suggestedId, courses }: { id: string; title: string; count: number; suggestedId: string | null; courses: { id: string; name: string }[] }) {
  const [courseId, setCourseId] = useState(suggestedId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) setError(r.error ?? "That did not work."); });

  return (
    <li className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center md:gap-4">
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block text-xs text-muted">{suggestedId ? "A student matched this by hand" : "Not in the catalog"}{count > 1 ? `, asked by ${count} students` : ""}</span>
      </span>
      <select className="input" aria-label={`Course for ${title}`} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
        <option value="">Choose the course</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <span className="flex gap-2">
        <Button size="sm" variant="primary" disabled={pending || !courseId} onClick={() => run(() => approveImportRequest(id, courseId))}>Approve</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => dismissImportRequest(id))}>Dismiss</Button>
      </span>
      {error && <p role="alert" className="text-xs text-red md:col-span-3">{error}</p>}
    </li>
  );
}
