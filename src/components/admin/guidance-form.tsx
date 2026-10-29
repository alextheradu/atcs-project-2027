"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { SUBJECTS, SUBJECT_LABEL, type GuidanceConfig, type Subject } from "@/lib/guidance";
import { saveGuidance } from "@/lib/guidance/actions";

export function GuidanceForm({ initial }: { initial: GuidanceConfig }) {
  const [base, setBase, baseDraft] = useDraftState("guidance:base", initial.base);
  const [majors, setMajors, majorsDraft] = useDraftState("guidance:majors", initial.majors.map((m) => ({ ...m, keywordsText: m.keywords.join(", ") })));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setMsg(null);
    start(async () => {
      try {
        const r = await saveGuidance({ base, majors: majors.map((m) => ({ label: m.label, keywords: m.keywordsText.split(",").map((k) => k.trim()).filter(Boolean), years: m.years })) });
        if (r.ok) { baseDraft.commit(base); majorsDraft.commit(majors); }
        setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
      } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED }); }
    });
  };
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-2 text-sm font-medium">Recommended years for every college bound student</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {SUBJECTS.map((s) => (
            <label key={s} className="space-y-1 text-[13px]"><span className="text-muted">{SUBJECT_LABEL[s]}</span>
              <input className="input num" type="number" min={0} max={4} value={base[s]} onChange={(e) => setBase({ ...base, [s]: num(e.target.value) })} />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-medium">Intended majors that need more</h2>
        {majors.map((m, i) => (
          <div key={i} className="space-y-2.5 border-t border-line pt-4">
            <input className="input" aria-label="Group name" value={m.label} onChange={(e) => setMajors(majors.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input className="input" aria-label="Words that match" placeholder="Words a student might type, separated by commas" value={m.keywordsText} onChange={(e) => setMajors(majors.map((x, j) => (j === i ? { ...x, keywordsText: e.target.value } : x)))} />
            <div className="grid gap-3 sm:grid-cols-5">
              {SUBJECTS.map((s: Subject) => (
                <label key={s} className="space-y-1 text-[13px]"><span className="text-muted">{SUBJECT_LABEL[s]}</span>
                  <input className="input num" type="number" min={0} max={4} placeholder="same" value={m.years[s] ?? ""} onChange={(e) => setMajors(majors.map((x, j) => (j === i ? { ...x, years: { ...x.years, [s]: e.target.value === "" ? undefined : num(e.target.value) } } : x)))} />
                </label>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMajors(majors.filter((_, j) => j !== i))}>Remove group</Button>
          </div>
        ))}
        <Button size="sm" onClick={() => setMajors([...majors, { label: "New group", keywords: [], keywordsText: "", years: {} }])} disabled={majors.length >= 12}>Add a group</Button>
      </section>

      <DraftNotice drafts={[baseDraft, majorsDraft]} />
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{msg.text}</p>}
      <Button variant="primary" disabled={pending} onClick={save}>{pending ? "Saving" : "Save"}</Button>
    </div>
  );
}
