import type { Grade } from "./grades";

/** A prerequisite rule tree. Stored as JSON in `Course.rules`. */

interface LeafBase {
  /**
   * Whether a student who does not meet this leaf can appeal. Left out means the engine decides:
   * a grade that is too low is appealable, a course that was skipped entirely is locked.
   */
  appealable?: boolean;
  /** The PDF only suggests this ("Suggested Co-requisite"). An unmet leaf warns, it does not fail. */
  advisory?: boolean;
  /** Plain language note shown with the leaf. */
  note?: string;
}

export interface AllRule {
  type: "all";
  rules: Rule[];
}
export interface AnyRule {
  type: "any";
  rules: Rule[];
}
/** Any one of `courses` was completed (a failing grade does not count). */
export interface CompletedRule extends LeafBase {
  type: "completed";
  courses: string[];
}
/** Any one of `courses` was completed with at least `grade`. */
export interface MinGradeRule extends LeafBase {
  type: "minGrade";
  courses: string[];
  grade: Grade;
  /** The PDF says "initial test/quiz average". We only have final grades, so it is an estimate. */
  basis: "initialAverage" | "final";
}
export interface GradeLevelRule extends LeafBase {
  type: "gradeLevel";
  in: number[];
}
/** Any one of `courses` is taken in the same year, or was finished earlier. */
export interface CoreqRule extends LeafBase {
  type: "coreq";
  courses: string[];
}
/** The student's own 8th grade math, from their profile. */
export interface PriorCourseworkRule extends LeafBase {
  type: "priorCoursework";
  field: "eighthMath";
  /** Leave out to accept any 8th grade math. */
  value?: "ALGEBRA_I" | "PRE_ALGEBRA";
  /** Minimum grade in that 8th grade course. */
  minGrade?: Grade;
}
/** Cannot be checked here (placement exam, audition, recommendation). Never passes or fails. */
export interface ManualRule extends LeafBase {
  type: "manual";
  label: string;
}

export type LeafRule = CompletedRule | MinGradeRule | GradeLevelRule | CoreqRule | PriorCourseworkRule | ManualRule;
export type Rule = AllRule | AnyRule | LeafRule;

export type Eligibility =
  | "ELIGIBLE"
  | "ELIGIBLE_WITH_WARNING"
  | "NOT_ELIGIBLE_APPEALABLE"
  | "NOT_ELIGIBLE_LOCKED";

export type EntryState = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

/** A course the student took or plans, by slug. */
export interface TakenCourse {
  slug: string;
  status: EntryState;
  grade?: Grade | null;
  gradeLevel: number;
}

export interface EvalContext {
  /** The grade the target course would be taken in. */
  gradeLevel: number;
  /** Everything else on the plan, plus past courses. Do not include the target itself. */
  taken: TakenCourse[];
  prior?: { eighthMath?: "ALGEBRA_I" | "PRE_ALGEBRA" | "UNSURE" | null; eighthMathGrade?: Grade | null };
  /** The plan entry carries an approved appeal for this course. */
  approvedAppeal?: boolean;
  /** Course names by slug, for messages. A slug is shown when a name is missing. */
  names?: Record<string, string>;
}

/** met: done. pending: depends on something not finished yet or on a person. unmet: not met. */
export type LeafState = "met" | "pending" | "manual" | "unmet";

export interface LeafResult {
  rule: LeafRule;
  state: LeafState;
  /** Only meaningful when `state` is `unmet`. */
  appealable: boolean;
  /** One plain sentence for the student. */
  message: string;
}

export type NodeState = "met" | "pending" | "unmetAppealable" | "unmetLocked";

export type NodeResult =
  | { kind: "leaf"; state: NodeState; leaf: LeafResult }
  | { kind: "all" | "any"; state: NodeState; children: NodeResult[] };

export interface EvalResult {
  status: Eligibility;
  tree: NodeResult | null;
  /** Every leaf in rule order, for lists. */
  leaves: LeafResult[];
  /** Leaves that stand between the student and the course. */
  unmet: LeafResult[];
  viaAppeal: boolean;
  /** One sentence for the badge tooltip or the plan warning. */
  summary: string;
}
