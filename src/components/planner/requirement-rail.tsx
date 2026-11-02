import { HINTS } from "@/lib/learn/content";
import { formatCredits } from "@/lib/credits";
import { describeWarning, type PlanWarning } from "@/lib/plan-warnings";
import type { GuidanceResult } from "@/lib/guidance";
import type { GraduationSummary, KindProgress } from "@/lib/requirements";

function Meter({ earned, scheduled, required, label }: { earned: number; scheduled: number; required: number; label: string }) {
  const e = required > 0 ? Math.min(100, (earned / required) * 100) : 0;
  const s = required > 0 ? Math.min(100 - e, (scheduled / required) * 100) : 0;
  return (
    <div role="img" aria-label={label} className="flex h-1 overflow-hidden rounded-full bg-elevated">
      <div className="h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${e}%` }} />
      <div className="h-full bg-accent/40 transition-[width] duration-300 ease-out" style={{ width: `${s}%` }} />
    </div>
  );
}

function KindRow({ k }: { k: KindProgress }) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span>
          {k.label}
          {k.provisional > 0 && <span className="text-muted" title="Some of these courses are not confirmed by a counselor yet"> *</span>}
        </span>
        <span className="num">
          <span className={k.met ? "text-green" : "text-fg"}>{formatCredits(k.total)}</span>
          <span className="text-muted"> / {formatCredits(k.required)}</span>
        </span>
      </div>
      <div className="mt-1.5">
        <Meter earned={k.earned} scheduled={k.scheduled} required={k.required} label={`${k.label}: ${formatCredits(k.total)} of ${formatCredits(k.required)} credits`} />
      </div>
    </li>
  );
}

export function RequirementRail({ summary, warnings, advice }: { summary: GraduationSummary; warnings: PlanWarning[]; advice?: GuidanceResult | null }) {
  const unconfirmed = summary.kinds.some((k) => k.provisional > 0);
  // Most work left first; finished requirements fold away so the open ones stay in view.
  const open = summary.kinds.filter((k) => !k.met).sort((a, b) => b.missing - a.missing);
  const met = summary.kinds.filter((k) => k.met);
  return (
    <aside aria-label="Graduation progress" className="space-y-8 xl:sticky xl:top-20 xl:self-start">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow" title={HINTS.credits}>Credits</h2>
          <span className="num">
            <span className="text-fg">{formatCredits(summary.total)}</span>
            <span className="text-muted"> / {formatCredits(summary.totalRequired)}</span>
          </span>
        </div>
        <div className="mt-3">
          <Meter
            earned={summary.earned}
            scheduled={summary.scheduled}
            required={summary.totalRequired}
            label={`${formatCredits(summary.total)} of ${formatCredits(summary.totalRequired)} credits`}
          />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {summary.complete
            ? "Every requirement is covered."
            : summary.missing > 0
              ? `${formatCredits(summary.missing)} more credits to reach ${formatCredits(summary.totalRequired)}.`
              : "Total credits are covered. Some requirements are still open."}
        </p>
        <dl className="mt-3 flex gap-5 text-[13px]">
          <div className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-accent" /><dt className="text-muted">Completed</dt><dd className="num">{formatCredits(summary.earned)}</dd></div>
          <div className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-accent/40" /><dt className="text-muted">Planned</dt><dd className="num">{formatCredits(summary.scheduled)}</dd></div>
        </dl>
      </section>

      <section>
        <h2 className="mb-1 eyebrow">Requirements</h2>
        {open.length > 0 && (
          <ul className="list">
            {open.map((k) => <KindRow key={k.kind} k={k} />)}
          </ul>
        )}
        {met.length > 0 && (
          <details className="group border-b border-line" open={open.length === 0}>
            <summary className="flex cursor-pointer list-none items-baseline justify-between py-2.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg [&::-webkit-details-marker]:hidden">
              <span><span className="num text-green">{met.length}</span> complete</span>
              <span aria-hidden className="text-xs group-open:hidden">Show</span>
              <span aria-hidden className="hidden text-xs group-open:inline">Hide</span>
            </summary>
            <ul className="list">
              {met.map((k) => <KindRow key={k.kind} k={k} />)}
            </ul>
          </details>
        )}
        {unconfirmed && <p className="mt-2 text-xs text-muted">* Counts toward this requirement, but a counselor has not confirmed which courses qualify yet.</p>}
      </section>

      <section>
        <h2 className="mb-2 eyebrow">Heads up</h2>
        {warnings.length === 0 ? (
          <p className="text-[13px] text-muted">Nothing to flag.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-yellow" />
                <span className="text-muted">{describeWarning(w)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Warnings never block your plan. The school makes the final decision.</p>
      </section>
          {advice && (
        <section>
          <h2 className="mb-1 eyebrow">For college</h2>
          <p className="mb-2 text-xs text-muted">
            Years of each subject colleges usually look for{advice.matched.length > 0 ? `, raised for ${advice.matched.join(" and ").toLowerCase()} majors` : ""}. A recommendation, not a graduation rule.
          </p>
          <ul className="list">
            {advice.lines.map((l) => (
              <li key={l.subject} className="flex items-baseline justify-between py-2 text-[13px]">
                <span>{l.label}</span>
                <span className="num"><span className={l.met ? "text-green" : "text-fg"}>{l.have}</span><span className="text-muted"> / {l.need} years</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
</aside>
  );
}
