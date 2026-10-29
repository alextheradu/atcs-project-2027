"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DEPT_LABEL } from "@/lib/catalog/labels";
import { saveQuestion } from "@/lib/appeals/admin";

export interface QRow {
  id: string;
  department: string | null;
  prompt: string;
  helpText: string | null;
  type: "TEXT" | "LONG_TEXT" | "NUMBER" | "YES_NO" | "CHOICE";
  options: string[];
  required: boolean;
  sortOrder: number;
  active: boolean;
}

const BLANK: Omit<QRow, "id"> = { department: null, prompt: "", helpText: null, type: "LONG_TEXT", options: [], required: true, sortOrder: 50, active: true };

function Editor({ row, departments, canAll, onDone }: { row: QRow | null; departments: string[]; canAll: boolean; onDone: () => void }) {
  const [q, setQ] = useState<Omit<QRow, "id">>(row ?? { ...BLANK, department: canAll ? null : departments[0] ?? null });
  const [opts, setOpts] = useState(q.options.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof q>(k: K, v: (typeof q)[K]) => setQ((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    start(async () => {
      const r = await saveQuestion(row?.id ?? null, { ...q, helpText: q.helpText || null, options: q.type === "CHOICE" ? opts.split(",").map((s) => s.trim()).filter(Boolean) : undefined });
      if (r.ok) onDone();
      else setError(r.error);
    });
  }

  return (
    <div className="grid gap-2.5 border-y border-line py-4 sm:grid-cols-2">
      <input className="input sm:col-span-2" aria-label="Question" placeholder="Question" maxLength={300} value={q.prompt} onChange={(e) => set("prompt", e.target.value)} />
      <input className="input sm:col-span-2" aria-label="Help text" placeholder="Help text (optional)" maxLength={300} value={q.helpText ?? ""} onChange={(e) => set("helpText", e.target.value || null)} />
      <select className="input" aria-label="Department" value={q.department ?? ""} disabled={!!row} onChange={(e) => set("department", e.target.value || null)}>
        {canAll && <option value="">All departments</option>}
        {departments.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
      </select>
      <select className="input" aria-label="Answer type" value={q.type} onChange={(e) => set("type", e.target.value as QRow["type"])}>
        <option value="LONG_TEXT">Long answer</option><option value="TEXT">Short answer</option><option value="NUMBER">Number</option><option value="YES_NO">Yes or no</option><option value="CHOICE">Choice</option>
      </select>
      {q.type === "CHOICE" && <input className="input sm:col-span-2" aria-label="Options" placeholder="Options, separated by commas" value={opts} onChange={(e) => setOpts(e.target.value)} />}
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={q.required} onChange={(e) => set("required", e.target.checked)} /> Required</label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={q.active} onChange={(e) => set("active", e.target.checked)} /> Shown to students</label>
      <label className="flex items-center gap-2 text-[13px]"><span className="text-muted">Order</span><input className="input num !w-24" type="number" min={0} max={999} value={q.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></label>
      {error && <p role="alert" className="text-[13px] text-red sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <Button variant="primary" size="sm" disabled={pending || q.prompt.trim().length < 3} onClick={save}>Save</Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

export function QuestionEditor({ rows, departments, canAll }: { rows: QRow[]; departments: string[]; canAll: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div className="space-y-6">
      <ul className="list">
        {rows.map((r) => (
          <li key={r.id} className="py-3">
            {editing === r.id ? (
              <Editor row={r} departments={departments} canAll={canAll} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{r.prompt}</span>
                  <span className="block text-xs text-muted">{r.department ? DEPT_LABEL[r.department] : "All departments"} · {r.required ? "required" : "optional"}{r.active ? "" : " · hidden"}</span>
                </span>
                {(r.department !== null || canAll) && <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>Edit</Button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? <Editor row={null} departments={departments} canAll={canAll} onDone={() => setEditing(null)} /> : <Button size="sm" onClick={() => setEditing("new")}>Add a question</Button>}
    </div>
  );
}
