/** Eligibility engine. Pure and shared by client and server. See docs/spec/06-eligibility-pathways.md. */
import { gradeAtLeast, gradeText, isPassing, type Grade } from "./grades";
import type {
  Eligibility,
  EvalContext,
  EvalResult,
  LeafResult,
  LeafRule,
  NodeResult,
  NodeState,
  Rule,
  TakenCourse,
} from "./types";

const RANK: Record<NodeState, number> = { met: 0, pending: 1, unmetAppealable: 2, unmetLocked: 3 };
const worst = (states: NodeState[]): NodeState => states.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "met");
const best = (states: NodeState[]): NodeState => states.reduce((a, b) => (RANK[b] < RANK[a] ? b : a));

type Standing = "done" | "failed" | "pending" | "late";

/** Where one entry stands relative to the course being checked. */
function standing(t: TakenCourse, level: number): Standing {
  if (t.status === "COMPLETED") return t.grade && !isPassing(t.grade) ? "failed" : "done";
  return t.gradeLevel < level ? "pending" : "late";
}

const nameOf = (ctx: EvalContext, slug: string) => ctx.names?.[slug] ?? slug;
const listNames = (ctx: EvalContext, slugs: string[]) => slugs.map((s) => nameOf(ctx, s)).join(" or ");

const result = (
  rule: LeafRule,
  state: LeafResult["state"],
  message: string,
  defaultAppealable: boolean,
): LeafResult => {
  // An advisory leaf ("Suggested Co-requisite") warns when unmet. It never fails.
  if (state === "unmet" && rule.advisory) {
    return { rule, state: "pending", appealable: true, message: `Suggested: ${message}` };
  }
  return { rule, state, appealable: rule.appealable ?? defaultAppealable, message };
};

function evalCompleted(rule: Extract<LeafRule, { type: "completed" }>, ctx: EvalContext): LeafResult {
  const hits = ctx.taken.filter((t) => rule.courses.includes(t.slug));
  const marks = hits.map((t) => ({ t, s: standing(t, ctx.gradeLevel) }));
  const names = listNames(ctx, rule.courses);
  const done = marks.find((m) => m.s === "done");
  if (done) return result(rule, "met", `Completed ${nameOf(ctx, done.t.slug)}.`, true);
  const pend = marks.find((m) => m.s === "pending");
  if (pend) {
    return result(rule, "pending", `${nameOf(ctx, pend.t.slug)} is planned for grade ${pend.t.gradeLevel}. Finish it first.`, true);
  }
  const failed = marks.find((m) => m.s === "failed");
  if (failed) return result(rule, "unmet", `You did not pass ${nameOf(ctx, failed.t.slug)}.`, true);
  const late = marks.find((m) => m.s === "late");
  if (late) {
    return result(rule, "unmet", `${nameOf(ctx, late.t.slug)} is planned for grade ${late.t.gradeLevel}, after this course.`, false);
  }
  return result(rule, "unmet", `Needs ${names}.`, false);
}

function evalMinGrade(rule: Extract<LeafRule, { type: "minGrade" }>, ctx: EvalContext): LeafResult {
  const need = gradeText(rule.grade);
  const approx = rule.basis === "initialAverage" ? " Your final grade stands in for the initial test/quiz average." : "";
  const marks = ctx.taken
    .filter((t) => rule.courses.includes(t.slug))
    .map((t) => ({ t, s: standing(t, ctx.gradeLevel) }));

  let lowest: { t: TakenCourse } | null = null;
  let noGrade: TakenCourse | null = null;
  let passOnly: TakenCourse | null = null;
  for (const { t, s } of marks) {
    if (s === "done" || s === "failed") {
      if (!t.grade) {
        noGrade = t;
        continue;
      }
      const ok = gradeAtLeast(t.grade, rule.grade);
      if (ok === true) return result(rule, "met", `${gradeText(t.grade)} in ${nameOf(ctx, t.slug)}.${approx}`, true);
      if (ok === null) passOnly = t;
      else if (!lowest || (gradeAtLeast(t.grade, lowest.t.grade as Grade) ?? false)) lowest = { t };
    }
  }
  const pend = marks.find((m) => m.s === "pending");
  if (pend) {
    return result(rule, "pending", `${nameOf(ctx, pend.t.slug)} is planned for grade ${pend.t.gradeLevel}. It needs a ${need} or higher.${approx}`, true);
  }
  if (noGrade) return result(rule, "pending", `Add your grade for ${nameOf(ctx, noGrade.slug)}. It needs a ${need} or higher.${approx}`, true);
  if (passOnly) return result(rule, "pending", `${nameOf(ctx, passOnly.slug)} is recorded as Pass. It needs a ${need} or higher, so check with your supervisor.`, true);
  if (lowest) {
    return result(rule, "unmet", `You have a ${gradeText(lowest.t.grade as Grade)} in ${nameOf(ctx, lowest.t.slug)}. This needs a ${need} or higher.${approx}`, true);
  }
  const late = marks.find((m) => m.s === "late");
  if (late) {
    return result(rule, "unmet", `${nameOf(ctx, late.t.slug)} is planned for grade ${late.t.gradeLevel}, after this course.`, false);
  }
  return result(rule, "unmet", `Needs a ${need} or higher in ${listNames(ctx, rule.courses)}.${approx}`, false);
}

function evalCoreq(rule: Extract<LeafRule, { type: "coreq" }>, ctx: EvalContext): LeafResult {
  const names = listNames(ctx, rule.courses);
  const hits = ctx.taken.filter((t) => rule.courses.includes(t.slug));
  const ok = hits.find((t) => (t.status === "COMPLETED" ? !(t.grade && !isPassing(t.grade)) : t.gradeLevel <= ctx.gradeLevel));
  if (ok) {
    const together = ok.status !== "COMPLETED" && ok.gradeLevel === ctx.gradeLevel;
    return result(rule, "met", together ? `${nameOf(ctx, ok.slug)} is in the same year.` : `Completed ${nameOf(ctx, ok.slug)}.`, true);
  }
  const later = hits[0];
  if (later) {
    return result(rule, "unmet", `${nameOf(ctx, later.slug)} is planned for grade ${later.gradeLevel}. Take it in grade ${ctx.gradeLevel} or earlier.`, true);
  }
  return result(rule, "unmet", `Take ${names} in grade ${ctx.gradeLevel} too, or finish it first.`, true);
}

const EIGHTH: Record<string, string> = { ALGEBRA_I: "Algebra I", PRE_ALGEBRA: "Pre-Algebra" };

function evalPrior(rule: Extract<LeafRule, { type: "priorCoursework" }>, ctx: EvalContext): LeafResult {
  const have = ctx.prior?.eighthMath;
  if (!have || have === "UNSURE") {
    return result(rule, "pending", "Add your 8th grade math in your profile to check this.", true);
  }
  if (rule.value && have !== rule.value) {
    // Your 8th grade course cannot change, so a mismatch reads as a skipped step, like a missing course.
    return result(rule, "unmet", `This needs 8th grade ${EIGHTH[rule.value]}. You took ${EIGHTH[have]}.`, false);
  }
  const label = `8th grade ${rule.value ? EIGHTH[rule.value] : "math"}`;
  if (rule.minGrade) {
    const g = ctx.prior?.eighthMathGrade;
    if (!g) return result(rule, "pending", `Add your ${label} grade in your profile.`, true);
    const ok = gradeAtLeast(g, rule.minGrade);
    if (ok === null) return result(rule, "pending", `Your ${label} grade is recorded as Pass. Check with your supervisor.`, true);
    if (!ok) return result(rule, "unmet", `You have a ${gradeText(g)} in ${label}. This needs a ${gradeText(rule.minGrade)} or higher.`, true);
  }
  return result(rule, "met", `Took ${label}.`, true);
}

export function evaluateLeaf(rule: LeafRule, ctx: EvalContext): LeafResult {
  switch (rule.type) {
    case "completed":
      return evalCompleted(rule, ctx);
    case "minGrade":
      return evalMinGrade(rule, ctx);
    case "coreq":
      return evalCoreq(rule, ctx);
    case "priorCoursework":
      return evalPrior(rule, ctx);
    case "gradeLevel":
      return rule.in.includes(ctx.gradeLevel)
        ? result(rule, "met", `Grade ${ctx.gradeLevel} is allowed.`, false)
        : result(rule, "unmet", `Only for grade ${rule.in.join(", ")}.`, false);
    case "manual":
      return { rule, state: "manual", appealable: true, message: rule.label };
  }
}

const leafNodeState = (l: LeafResult): NodeState =>
  l.state === "met" ? "met" : l.state === "unmet" ? (l.appealable ? "unmetAppealable" : "unmetLocked") : "pending";

function walk(rule: Rule, ctx: EvalContext, leaves: LeafResult[]): NodeResult {
  if (rule.type === "all" || rule.type === "any") {
    const children = rule.rules.map((r) => walk(r, ctx, leaves));
    const states = children.map((c) => c.state);
    // An empty list asks for nothing.
    const state = states.length === 0 ? "met" : rule.type === "all" ? worst(states) : best(states);
    return { kind: rule.type, state, children };
  }
  const leaf = evaluateLeaf(rule, ctx);
  leaves.push(leaf);
  return { kind: "leaf", state: leafNodeState(leaf), leaf };
}

/** The leaves in the tree that explain the outcome. For `any`, only the closest branch. */
function explain(node: NodeResult, want: (l: LeafResult) => boolean): LeafResult[] {
  if (node.kind === "leaf") return want(node.leaf) ? [node.leaf] : [];
  if (node.kind === "all") return node.children.flatMap((c) => explain(c, want));
  const bestChild = node.children.reduce<NodeResult | null>((a, c) => (!a || RANK[c.state] < RANK[a.state] ? c : a), null);
  return bestChild ? explain(bestChild, want) : [];
}

const STATUS: Record<NodeState, Eligibility> = {
  met: "ELIGIBLE",
  pending: "ELIGIBLE_WITH_WARNING",
  unmetAppealable: "NOT_ELIGIBLE_APPEALABLE",
  unmetLocked: "NOT_ELIGIBLE_LOCKED",
};

export function evaluate(rules: Rule | null | undefined, ctx: EvalContext): EvalResult {
  if (!rules) {
    return { status: "ELIGIBLE", tree: null, leaves: [], unmet: [], viaAppeal: false, summary: "No prerequisites." };
  }
  const leaves: LeafResult[] = [];
  const tree = walk(rules, ctx, leaves);
  const unmet = explain(tree, (l) => l.state === "unmet");
  const open = explain(tree, (l) => l.state === "pending" || l.state === "manual");

  if (ctx.approvedAppeal && (tree.state === "unmetAppealable" || tree.state === "unmetLocked")) {
    return { status: "ELIGIBLE", tree, leaves, unmet, viaAppeal: true, summary: "Approved via appeal." };
  }

  const status = STATUS[tree.state];
  const summary =
    status === "ELIGIBLE"
      ? "You meet the requirements."
      : status === "ELIGIBLE_WITH_WARNING"
        ? (open[0]?.message ?? "Some requirements need confirming.")
        : (unmet[0]?.message ?? "Requirements not met.");
  return { status, tree, leaves, unmet, viaAppeal: false, summary };
}

/**
 * Evaluate a catalog course. A course with prerequisite text that nobody encoded yet cannot be
 * checked here, so it warns and shows the text instead of passing silently.
 */
export function evaluateCourse(
  course: { rules: Rule | null | undefined; prereqText: string | null | undefined },
  ctx: EvalContext,
): EvalResult {
  if (course.rules) return evaluate(course.rules, ctx);
  const text = course.prereqText?.trim();
  if (!text) return evaluate(null, ctx);
  return {
    status: "ELIGIBLE_WITH_WARNING",
    tree: null,
    leaves: [],
    unmet: [],
    viaAppeal: false,
    summary: "The catalog lists a prerequisite that is not checked automatically. Read it before you choose this course.",
  };
}
