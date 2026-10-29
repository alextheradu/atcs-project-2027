"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { deleteDraft, saveDraft, submitAppeal, withdrawAppeal } from "@/lib/appeals/actions";
import { GRADE_OPTIONS } from "@/lib/plans/view";

export interface FormQuestion {
  id: string;
  prompt: string;
  helpText: string | null;
  type: "TEXT" | "LONG_TEXT" | "NUMBER" | "YES_NO" | "CHOICE";
  options: string[];
  required: boolean;
}

interface Props {
  appealId: string;
  questions: FormQuestion[];
  initialAnswers: Record<string, string>;
  reportedGrade: string | null;
  reportedAverage: number | null;
  /** Null when the student may submit. Otherwise why not, with the next open date if known. */
  blocked: string | null;
}

export function AppealForm({ appealId, questions, initialAnswers, reportedGrade, reportedAverage, blocked }: Props) {
  const router = useRouter();
  const [answers, setAnswers, answerDraft] = useDraftState(`appeal:${appealId}:answers`, initialAnswers);
  const [grade, setGrade, gradeDraft] = useDraftState(`appeal:${appealId}:grade`, reportedGrade ?? "");
  const [avg, setAvg, avgDraft] = useDraftState(`appeal:${appealId}:average`, reportedAverage === null ? "" : String(reportedAverage));
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const payload = () => ({
    appealId,
    reportedGrade: grade || null,
    reportedAverage: avg === "" ? null : Number(avg),
    answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
  });

  function save(then?: () => Promise<{ ok: boolean; error?: string }>, okText = "Draft saved.") {
    setMsg(null);
    start(async () => {
      try {
        const s = await saveDraft(payload());
        if (!s.ok) return setMsg({ tone: "error", text: s.error });
        answerDraft.commit(answers); gradeDraft.commit(grade); avgDraft.commit(avg);
        if (!then) return setMsg({ tone: "ok", text: okText });
        const r = await then();
        if (!r.ok) return setMsg({ tone: "error", text: r.error ?? "That did not work." });
        router.refresh();
      } catch { setMsg({ tone: "error", text: SAVE_INTERRUPTED }); }
    });
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <DraftNotice drafts={[answerDraft, gradeDraft, avgDraft]} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[13px]">
          <span className="text-muted">Your grade in the prerequisite (self-reported)</span>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">I do not have one</option>
            {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[13px]">
          <span className="text-muted">Your test and quiz average, 0 to 100 (self-reported)</span>
          <input className="input num" type="number" min={0} max={100} step="0.01" value={avg} onChange={(e) => setAvg(e.target.value)} />
        </label>
      </div>

      {questions.map((q) => (
        <label key={q.id} className="block space-y-1.5 text-[13px]">
          <span className="font-medium">{q.prompt}{q.required && <span className="text-muted"> (required)</span>}</span>
          {q.helpText && <span className="block text-xs text-muted">{q.helpText}</span>}
          {q.type === "LONG_TEXT" ? (
            <textarea className="input" rows={4} maxLength={2000} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
          ) : q.type === "YES_NO" ? (
            <select className="input" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
              <option value="">Choose</option><option>Yes</option><option>No</option>
            </select>
          ) : q.type === "CHOICE" ? (
            <select className="input" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
              <option value="">Choose</option>
              {q.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input className="input" type={q.type === "NUMBER" ? "number" : "text"} maxLength={300} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
          )}
        </label>
      ))}

      <p className="text-xs text-muted">Your answers and grades are self-reported. A supervisor checks them against your real records.</p>
      {blocked && <p role="status" className="border-y border-line py-3 text-[13px] text-yellow">{blocked}</p>}
      {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={msg.tone === "error" ? "text-[13px] text-red" : "text-[13px] text-green"}>{msg.text}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={pending || !!blocked} onClick={() => save(() => submitAppeal(appealId))}>{pending ? "Working" : "Send request"}</Button>
        <Button disabled={pending} onClick={() => save()}>Save draft</Button>
        <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await deleteDraft(appealId); if (r.ok) { answerDraft.discard(); gradeDraft.discard(); avgDraft.discard(); router.push("/appeals"); } else setMsg({ tone: "error", text: r.error }); })}>Delete draft</Button>
      </div>
    </form>
  );
}

export function WithdrawButton({ appealId }: { appealId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await withdrawAppeal(appealId); if (r.ok) router.refresh(); else setError(r.error); })}>Withdraw request</Button>
      {error && <p role="alert" className="mt-2 text-[13px] text-red">{error}</p>}
    </div>
  );
}
