"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { createTimelineEvent, deleteTimelineEvent } from "@/lib/appeals/admin";

export interface TRow {
  id: string;
  kind: string;
  audience: string;
  label: string;
  schoolYear: string;
  opensAt: string;
  closesAt: string | null;
}

const KINDS: [string, string][] = [["APPEAL_WINDOW", "Appeal window"], ["COURSE_SELECTION", "Course selection"], ["GRADES_DUE", "Grades due"], ["APPEAL_DECISIONS", "Decisions due"], ["OTHER", "Other"]];
const day = (s: string) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function TimelineEditor({ rows }: { rows: TRow[] }) {
  const BLANK = { kind: "APPEAL_WINDOW", audience: "INCOMING", label: "", schoolYear: "", opensAt: "", closesAt: "" };
  const [f, setF, fDraft] = useDraftState("timeline:new", BLANK);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-10">
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{r.label}</span>
              <span className="num block text-xs text-muted">{KINDS.find((k) => k[0] === r.kind)?.[1]} · {r.audience.toLowerCase()} · {r.schoolYear} · {day(r.opensAt)}{r.closesAt ? ` to ${day(r.closesAt)}` : " onward"}</span>
            </span>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { const x = await deleteTimelineEvent(r.id); if (!x.ok) setError(x.error); })}>Delete</Button>
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-[13px] text-muted">No dates yet. Incoming students cannot submit until an appeal window is added.</li>}
      </ul>

      <section aria-label="Add dates" className="grid gap-2.5 sm:grid-cols-2">
        <h2 className="text-sm font-medium sm:col-span-2">Add dates</h2>
        <select className="input" aria-label="Kind" value={f.kind} onChange={(e) => set("kind", e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="input" aria-label="Audience" value={f.audience} onChange={(e) => set("audience", e.target.value)}><option value="INCOMING">Incoming 8th graders</option><option value="CURRENT">Current students</option><option value="ALL">Everyone</option></select>
        <input className="input sm:col-span-2" aria-label="Label" placeholder="Label, for example Spring 2028 course selection" maxLength={120} value={f.label} onChange={(e) => set("label", e.target.value)} />
        <input className="input" aria-label="School year" placeholder="School year, 2027-28" value={f.schoolYear} onChange={(e) => set("schoolYear", e.target.value)} />
        <span />
        <label className="space-y-1 text-[13px]"><span className="text-muted">Opens</span><input className="input" type="date" value={f.opensAt} onChange={(e) => set("opensAt", e.target.value)} /></label>
        <label className="space-y-1 text-[13px]"><span className="text-muted">Closes (optional)</span><input className="input" type="date" value={f.closesAt} onChange={(e) => set("closesAt", e.target.value)} /></label>
        <div className="sm:col-span-2"><DraftNotice drafts={[fDraft]} /></div>
        {error && <p role="alert" className="text-[13px] text-red sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button variant="primary" disabled={pending || !f.label || !f.opensAt || !f.schoolYear} onClick={() => { setError(null); start(async () => { try { const r = await createTimelineEvent({ ...f, opensAt: `${f.opensAt}T00:00:00Z`, closesAt: f.closesAt ? `${f.closesAt}T23:59:59Z` : null }); if (!r.ok) setError(r.error); else fDraft.commit(f, { ...f, label: "", opensAt: "", closesAt: "" }); } catch { setError(SAVE_INTERRUPTED); } }); }}>Add</Button>
        </div>
      </section>
    </div>
  );
}
