/** Eligibility across a whole plan. Pure, used on the server and in the planner. */
import { evaluateCourse } from "./evaluate";
import type { Grade } from "./grades";
import type { EvalContext, EvalResult, Rule, TakenCourse } from "./types";

export interface PlanCourse {
  /** Entry id, or any unique key for one placement. */
  key: string;
  slug: string;
  name: string;
  gradeLevel: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  grade: string | null;
  rules: Rule | null;
  prereqText: string | null;
  /** The entry carries an approved appeal. */
  approvedAppeal: boolean;
}

export interface StudentPrior {
  eighthMath?: "ALGEBRA_I" | "PRE_ALGEBRA" | "UNSURE" | null;
  eighthMathGrade?: string | null;
}

const asTaken = (c: PlanCourse): TakenCourse => ({
  slug: c.slug,
  status: c.status,
  grade: (c.grade as Grade | null) ?? null,
  gradeLevel: c.gradeLevel,
});

export function buildContext(
  gradeLevel: number,
  others: PlanCourse[],
  opts: { prior?: StudentPrior; names?: Record<string, string>; approvedAppeal?: boolean } = {},
): EvalContext {
  return {
    gradeLevel,
    taken: others.map(asTaken),
    prior: opts.prior ? { eighthMath: opts.prior.eighthMath ?? null, eighthMathGrade: (opts.prior.eighthMathGrade as Grade | null) ?? null } : undefined,
    approvedAppeal: opts.approvedAppeal,
    names: opts.names,
  };
}

/** The result for every placement on the plan, judged against the rest of the plan. */
export function evaluatePlan(
  courses: PlanCourse[],
  opts: { prior?: StudentPrior; names?: Record<string, string> } = {},
): Map<string, EvalResult> {
  const out = new Map<string, EvalResult>();
  for (const c of courses) {
    const others = courses.filter((o) => o.key !== c.key);
    const ctx = buildContext(c.gradeLevel, others, { ...opts, approvedAppeal: c.approvedAppeal });
    out.set(c.key, evaluateCourse(c, ctx));
  }
  return out;
}

export interface EligibilityWarning {
  code: "UNMET_PREREQ" | "MISSING_COREQ";
  entryId: string;
  name: string;
  detail: string;
}

/** Plan warnings for placements that fail their rules. A warning-level result is a badge, not a warning. */
export function eligibilityWarnings(courses: PlanCourse[], results: Map<string, EvalResult>): EligibilityWarning[] {
  const out: EligibilityWarning[] = [];
  for (const c of courses) {
    const r = results.get(c.key);
    if (!r || (r.status !== "NOT_ELIGIBLE_APPEALABLE" && r.status !== "NOT_ELIGIBLE_LOCKED")) continue;
    const onlyCoreq = r.unmet.length > 0 && r.unmet.every((l) => l.rule.type === "coreq");
    out.push({
      code: onlyCoreq ? "MISSING_COREQ" : "UNMET_PREREQ",
      entryId: c.key,
      name: c.name,
      detail: r.summary,
    });
  }
  return out;
}
