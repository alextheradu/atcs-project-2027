import { Breakdown } from "@/components/eligibility/breakdown";
import { EligibilityBadge } from "@/components/eligibility/status-badge";
import type { GradeFit } from "@/lib/eligibility";

/** Per grade eligibility for a course, plus the requirement list for the first open grade. */
export function CourseFitList({ fits }: { fits: GradeFit[] }) {
  if (fits.length === 0) return null;
  const focus = fits.find((f) => f.result.status !== "NOT_ELIGIBLE_LOCKED") ?? fits[0];
  return (
    <div className="space-y-5">
      <ul className="list">
        {fits.map((f) => (
          <li key={f.grade} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="num">Grade {f.grade}</span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="hidden min-w-0 truncate text-[13px] text-muted sm:block">{f.result.summary}</span>
              <EligibilityBadge result={f.result} className="shrink-0" />
            </span>
          </li>
        ))}
      </ul>
      {focus.result.tree && (
        <div>
          <h3 className="mb-1 text-xs font-medium text-muted">What it takes, checked for grade {focus.grade}</h3>
          <Breakdown tree={focus.result.tree} />
        </div>
      )}
    </div>
  );
}
