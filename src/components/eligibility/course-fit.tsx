import { Breakdown } from "@/components/eligibility/breakdown";
import { EligibilityBadge } from "@/components/eligibility/status-badge";
import type { GradeFit } from "@/lib/eligibility";

/** Per grade eligibility for a course, with the reason in words, plus the full rule for the first open grade. */
export function CourseFitList({ fits }: { fits: GradeFit[] }) {
  if (fits.length === 0) return null;
  const focus = fits.find((f) => f.result.status !== "NOT_ELIGIBLE_LOCKED") ?? fits[0];
  return (
    <div className="space-y-4">
      <ul className="list">
        {fits.map((f) => (
          <li key={f.grade} className="flex items-start justify-between gap-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="num block font-medium">Grade {f.grade}</span>
              {/* Shown on every screen: a phone cannot hover for a tooltip. */}
              <span className="mt-0.5 block text-[13px] text-muted">{f.result.summary}</span>
            </span>
            <EligibilityBadge result={f.result} className="shrink-0" />
          </li>
        ))}
      </ul>
      {focus.result.tree && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-accent-ink hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show the full rule for grade {focus.grade}</span>
            <span className="hidden group-open:inline">Hide the full rule</span>
          </summary>
          <div className="mt-2"><Breakdown tree={focus.result.tree} /></div>
        </details>
      )}
    </div>
  );
}
