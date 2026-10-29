"use client";

import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { updateGraduationConfig } from "@/lib/admin/graduation";
import type { GraduationSettings, RequirementRuleInput } from "@/lib/requirements";

const SETTING_FIELDS: { key: keyof GraduationSettings; label: string; help: string; step: number }[] = [
  { key: "totalRequired", label: "Total credits to graduate", help: "Across all four years.", step: 0.5 },
  { key: "minPerYear", label: "Minimum credits per year", help: "Warns when a year is under this.", step: 0.5 },
  { key: "minFinalYear", label: "Minimum credits in senior year", help: "Warns when grade 12 is under this.", step: 0.5 },
  { key: "maxPeriodsPerYear", label: "Most periods in one year", help: "Warns above this. Half-year courses count half.", step: 1 },
];

export function GraduationForm({ rules, settings }: { rules: RequirementRuleInput[]; settings: GraduationSettings }) {
  const [r, setR, ruleDraft] = useDraftState("graduation:rules", rules);
  const [s, setS, settingsDraft] = useDraftState("graduation:settings", settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const res = await updateGraduationConfig({ rules: r.map(({ kind, requiredCredits }) => ({ kind, requiredCredits })), settings: s });
            if (res.ok) { ruleDraft.commit(r); settingsDraft.commit(s); }
            setMsg(res.ok ? { ok: true, text: "Saved. Plans use the new numbers right away." } : { ok: false, text: res.error });
          } catch { setMsg({ ok: false, text: SAVE_INTERRUPTED }); }
        });
      }}
    >
      <DraftNotice drafts={[ruleDraft, settingsDraft]} />
      <div>
        <h3 className="mb-1 text-[13px] font-medium">Credits needed per requirement</h3>
        <ul className="list">
          {r.map((rule, i) => (
            <li key={rule.kind} className="flex items-center justify-between gap-4 py-2">
              <label htmlFor={`rule-${rule.kind}`} className="text-sm">{rule.label}</label>
              <input
                id={`rule-${rule.kind}`}
                className="input num !w-24 text-right"
                type="number"
                step={0.5}
                min={0}
                max={200}
                value={rule.requiredCredits}
                onChange={(e) => setR((rs) => rs.map((x, j) => (j === i ? { ...x, requiredCredits: Number(e.target.value) } : x)))}
              />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-[13px] font-medium">Credit rules</h3>
        <ul className="list">
          {SETTING_FIELDS.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-4 py-2">
              <span>
                <label htmlFor={`set-${f.key}`} className="block text-sm">{f.label}</label>
                <span className="block text-[13px] text-muted">{f.help}</span>
              </span>
              <input
                id={`set-${f.key}`}
                className="input num !w-24 text-right"
                type="number"
                step={f.step}
                min={0}
                max={200}
                value={s[f.key]}
                onChange={(e) => setS((x) => ({ ...x, [f.key]: Number(e.target.value) }))}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" type="submit" disabled={pending}>Save thresholds</Button>
        {msg && <span role="status" className={msg.ok ? "text-[13px] text-green" : "text-[13px] text-red"}>{msg.text}</span>}
      </div>
    </form>
  );
}
