"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { GRADE_OPTIONS } from "@/lib/plans/view";
import { savePriorMath } from "@/lib/profile/prior";

/**
 * 8th grade math, asked right where a math class needs it instead of sending the student to another page.
 * Saving refreshes the page, so every class on the board is checked again with the new answer.
 */
export function PriorMathField({ initial }: { initial?: { eighthMath?: string | null; eighthMathGrade?: string | null } }) {
  const router = useRouter();
  const [math, setMath] = useState(initial?.eighthMath && initial.eighthMath !== "UNSURE" ? initial.eighthMath : "");
  const [grade, setGrade] = useState(initial?.eighthMathGrade ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await savePriorMath({ eighthMath: math, eighthMathGrade: grade });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[13px] text-muted">8th grade math</span>
          <select className="input bg-fill-3" value={math} onChange={(e) => setMath(e.target.value)}>
            <option value="">Choose one</option>
            <option value="ALGEBRA_I">Algebra I</option>
            <option value="PRE_ALGEBRA">Pre-Algebra or Math 8</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[13px] text-muted">Your grade in it</span>
          <select className="input bg-fill-3" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Not sure yet</option>
            {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!math || pending} onClick={save}>{pending ? "Saving..." : "Save"}</Button>
        {saved && !pending && <p role="status" className="text-[13px] text-muted">Saved. Your classes were checked again.</p>}
        {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
      </div>
    </div>
  );
}
