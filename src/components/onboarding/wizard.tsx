"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LEARN_CARDS } from "@/lib/learn/content";
import { acceptPolicies, chooseGrade, finishOnboarding, saveCurrentBackground, saveIncomingBackground, saveMajor, setStep } from "@/lib/onboarding/actions";
import { HONESTY_TEXT } from "@/lib/onboarding/schemas";
import { cn } from "@/lib/utils";

interface Props {
  startStep: number;
  cohort: "CURRENT" | "INCOMING_8" | null;
  policies: { id: string; kind: string; title: string; summary: string; href: string }[];
  interests: { slug: string; label: string }[];
  needsAgeBox: boolean;
}

const GRADE_OPTS = ["A_PLUS", "A", "A_MINUS", "B_PLUS", "B", "B_MINUS", "C_PLUS", "C", "C_MINUS", "D_PLUS", "D"];
const GRADE_LABEL: Record<string, string> = { A_PLUS: "A+", A: "A", A_MINUS: "A-", B_PLUS: "B+", B: "B", B_MINUS: "B-", C_PLUS: "C+", C: "C", C_MINUS: "C-", D_PLUS: "D+", D: "D" };
const TITLES = ["Your grade", "Privacy and terms", "The basics", "About you", "Your goals", "Notifications", "Done"];

function GradeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">I don&apos;t know yet / prefer not to say</option>
        {GRADE_OPTS.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
      </select>
    </label>
  );
}

export function Wizard({ startStep, cohort: startCohort, policies, interests, needsAgeBox }: Props) {
  const router = useRouter();
  const [step, setStepState] = useState(Math.min(startStep, 6));
  const [cohort, setCohort] = useState(startCohort);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [ageOk, setAgeOk] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [card, setCard] = useState(0);
  const [form, setForm] = useState({ eighthMath: "", eighthMathGrade: "", scienceGrade: "", englishGrade: "", historyGrade: "", languageStudied: "none", languageLevel: 1, start: "blank" as "blank" | "import" });
  const [picked, setPicked] = useState<string[]>([]);
  const [honest, setHonest] = useState(false);
  const [major, setMajor] = useState("");

  const go = (n: number) => { setError(null); setStepState(n); };
  function run(fn: () => Promise<{ ok: boolean; error?: string }>, next: number) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "That did not work.");
      else go(next);
    });
  }
  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const lang = { languageStudied: form.languageStudied, languageLevel: form.languageStudied === "none" ? null : form.languageLevel };

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <p className="num text-muted" aria-live="polite">Step {Math.min(step + 1, 7)} of 7 · {TITLES[step]}</p>
      <div className="mt-2 flex gap-1" aria-hidden>
        {TITLES.map((_, i) => <span key={i} className={cn("h-0.5 flex-1 rounded-full", i <= step ? "bg-fg" : "bg-line-strong")} />)}
      </div>

      <div className="mt-10 space-y-6">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">What grade are you in?</h1>
            <p className="text-[13px] text-muted">This sets up your plan. Pick the grade you are in right now.</p>
            <div className="grid grid-cols-5 gap-2">
              {[8, 9, 10, 11, 12].map((g) => (
                <Button key={g} variant="default" disabled={pending} onClick={() => run(async () => { const r = await chooseGrade({ grade: g }, ageOk); if (r.ok) setCohort(g === 8 ? "INCOMING_8" : "CURRENT"); return r; }, 1)}>
                  {g}th
                </Button>
              ))}
            </div>
            {needsAgeBox && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} /> I am 13 or older
              </label>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Privacy and terms</h1>
            <ul className="list">
              {policies.map((p) => (
                <li key={p.id} className="py-3">
                  <a href={p.href} target="_blank" rel="noreferrer" className="text-sm font-medium underline-offset-4 hover:underline">{p.title}</a>
                  <p className="mt-1 text-[13px] text-muted">{p.summary}</p>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              I have read the privacy policy and terms and I agree.
            </label>
            <Button variant="primary" disabled={!agreed || pending} onClick={() => run(acceptPolicies, 2)}>Continue</Button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{LEARN_CARDS[card].title}</h1>
            <div className="min-h-[7rem] space-y-3 text-sm leading-relaxed" aria-live="polite">
              {LEARN_CARDS[card].body.map((p) => <p key={p}>{p}</p>)}
            </div>
            <div className="flex items-center justify-between">
              <span className="num text-muted">{card + 1} / {LEARN_CARDS.length}</span>
              <span className="flex gap-2">
                <Button variant="ghost" onClick={() => run(() => setStep(3), 3)}>Skip</Button>
                {card > 0 && <Button onClick={() => setCard(card - 1)}>Back</Button>}
                <Button variant="primary" onClick={() => (card < LEARN_CARDS.length - 1 ? setCard(card + 1) : run(() => setStep(3), 3))}>
                  {card < LEARN_CARDS.length - 1 ? "Next" : "Done"}
                </Button>
              </span>
            </div>
            <p className="text-xs text-muted">You can read these again any time in Help.</p>
          </>
        )}

        {step === 3 && cohort === "CURRENT" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">A little about your past courses</h1>
            <p className="text-[13px] text-muted">This helps the planner start your math path in the right place.</p>
            <label className="block space-y-1 text-[13px]">
              <span className="text-muted">Math in 8th grade</span>
              <select className="input" value={form.eighthMath} onChange={(e) => set("eighthMath", e.target.value)}>
                <option value="">Choose one</option>
                <option value="ALGEBRA_I">Algebra I</option>
                <option value="PRE_ALGEBRA">Pre-Algebra</option>
                <option value="UNSURE">Not sure</option>
              </select>
            </label>
            <label className="block space-y-1 text-[13px]">
              <span className="text-muted">World language you studied before high school</span>
              <select className="input" value={form.languageStudied} onChange={(e) => set("languageStudied", e.target.value)}>
                <option value="none">None</option>
                {["chinese", "french", "italian", "spanish"].map((l) => <option key={l} value={l} className="capitalize">{l[0].toUpperCase() + l.slice(1)}</option>)}
              </select>
            </label>
            <fieldset className="space-y-2 text-[13px]">
              <legend className="text-muted">Your plan</legend>
              <label className="flex items-center gap-2"><input type="radio" name="start" checked={form.start === "blank"} onChange={() => set("start", "blank")} /> Start with a blank plan</label>
              <label className="flex items-center gap-2"><input type="radio" name="start" checked={form.start === "import"} onChange={() => set("start", "import")} /> Import a transcript (arrives in a later update, we will start you blank)</label>
            </fieldset>
            <Button variant="primary" disabled={!form.eighthMath || pending} onClick={() => run(() => saveCurrentBackground({ eighthMath: form.eighthMath, languageStudied: form.languageStudied, languageLevel: lang.languageLevel, start: form.start }), 4)}>Continue</Button>
          </>
        )}

        {step === 3 && cohort === "INCOMING_8" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Tell us about you</h1>
            <p role="note" className="border-y border-line py-3 text-[13px] leading-relaxed">{HONESTY_TEXT}</p>
            <fieldset>
              <legend className="mb-2 text-[13px] text-muted">What are you interested in? Pick any.</legend>
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <button key={i.slug} type="button" aria-pressed={picked.includes(i.slug)} onClick={() => setPicked((p) => (p.includes(i.slug) ? p.filter((x) => x !== i.slug) : [...p, i.slug]))}
                    className={cn("btn btn-sm", picked.includes(i.slug) && "btn-primary")}>
                    {i.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[13px] sm:col-span-2">
                <span className="text-muted">Math in 8th grade</span>
                <select className="input" value={form.eighthMath} onChange={(e) => set("eighthMath", e.target.value)}>
                  <option value="">Choose one</option>
                  <option value="ALGEBRA_I">Algebra I</option>
                  <option value="PRE_ALGEBRA">Pre-Algebra</option>
                  <option value="UNSURE">Not sure</option>
                </select>
              </label>
              <GradeSelect label="Math grade" value={form.eighthMathGrade} onChange={(v) => set("eighthMathGrade", v)} />
              <GradeSelect label="Science grade" value={form.scienceGrade} onChange={(v) => set("scienceGrade", v)} />
              <GradeSelect label="English grade" value={form.englishGrade} onChange={(v) => set("englishGrade", v)} />
              <GradeSelect label="History grade" value={form.historyGrade} onChange={(v) => set("historyGrade", v)} />
              <label className="space-y-1 text-[13px]">
                <span className="text-muted">World language (optional)</span>
                <select className="input" value={form.languageStudied} onChange={(e) => set("languageStudied", e.target.value)}>
                  <option value="none">None</option>
                  {["chinese", "french", "italian", "spanish"].map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
                </select>
              </label>
              {form.languageStudied !== "none" && (
                <label className="space-y-1 text-[13px]">
                  <span className="text-muted">Level</span>
                  <select className="input" value={form.languageLevel} onChange={(e) => set("languageLevel", Number(e.target.value))}>
                    {[1, 2, 3].map((n) => <option key={n} value={n}>Level {n}</option>)}
                  </select>
                </label>
              )}
            </div>
            <p className="text-xs text-muted">What you enter here is private, labeled self-reported, and deleted at the end of your first appeal cycle. See the privacy policy.</p>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={honest} onChange={(e) => setHonest(e.target.checked)} /> I&apos;m answering honestly</label>
            <Button variant="primary" disabled={!form.eighthMath || !honest || pending} onClick={() => run(() => saveIncomingBackground({ interests: picked, eighthMath: form.eighthMath, eighthMathGrade: form.eighthMathGrade, scienceGrade: form.scienceGrade, englishGrade: form.englishGrade, historyGrade: form.historyGrade, languageStudied: form.languageStudied, languageLevel: lang.languageLevel, honest }), 4)}>Continue</Button>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Anything you want to study or work in?</h1>
            <p className="text-[13px] text-muted">Optional. It helps with college requirement tips later.</p>
            <input className="input" aria-label="Intended major or career" maxLength={120} placeholder="For example: nursing, engineering, undecided" value={major} onChange={(e) => setMajor(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={pending} onClick={() => run(() => saveMajor({ intendedMajor: major }), 5)}>Continue</Button>
              <Button variant="ghost" disabled={pending} onClick={() => run(() => setStep(5), 5)}>Skip</Button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications and install</h1>
            <p className="text-[13px] text-muted">Email and push reminders for deadlines and appeal decisions arrive in a later update, and you will choose them in Settings.</p>
            <p className="text-[13px] text-muted">You will be able to install this as an app. On iPhone, push only works after you tap Share, then Add to Home Screen, on iOS 16.4 or later.</p>
            <Button variant="primary" disabled={pending} onClick={() => run(() => setStep(6), 6)}>Continue</Button>
          </>
        )}

        {step >= 6 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">You are set up</h1>
            <p className="text-[13px] text-muted">
              {cohort === "INCOMING_8"
                ? "We made a starter Plan A for 9th grade. It is a draft based on self-reported info. Anything marked worth considering is up to a supervisor, not a placement."
                : "We made a blank Plan A for you. Add courses by hand or drag them in."}
            </p>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await finishOnboarding(); if (r.ok) router.push(`/plans/${r.data?.planId}?tour=1`); else setError(r.error); })}>Open my plan</Button>
          </>
        )}

        {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
      </div>
    </div>
  );
}
