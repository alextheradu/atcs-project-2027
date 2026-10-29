import { z } from "zod";
import { GRADES } from "./grades";
import type { Rule } from "./types";

const grade = z.enum([...GRADES, "PASS"] as [string, ...string[]]);
const slug = z.string().min(1).max(120);
const slugs = z.array(slug).min(1).max(60);

const leaf = {
  appealable: z.boolean().optional(),
  advisory: z.boolean().optional(),
  note: z.string().max(300).optional(),
};

const completed = z.object({ type: z.literal("completed"), courses: slugs, ...leaf });
const minGrade = z.object({
  type: z.literal("minGrade"),
  courses: slugs,
  grade,
  basis: z.enum(["initialAverage", "final"]),
  ...leaf,
});
const gradeLevel = z.object({ type: z.literal("gradeLevel"), in: z.array(z.number().int().min(6).max(12)).min(1).max(7), ...leaf });
const coreq = z.object({ type: z.literal("coreq"), courses: slugs, ...leaf });
const prior = z.object({
  type: z.literal("priorCoursework"),
  field: z.literal("eighthMath"),
  value: z.enum(["ALGEBRA_I", "PRE_ALGEBRA"]).optional(),
  minGrade: grade.optional(),
  ...leaf,
});
const manual = z.object({ type: z.literal("manual"), label: z.string().min(1).max(200), ...leaf });

export const MAX_DEPTH = 6;

/** Depth is capped so an editor cannot save a tree nobody can read. */
const node = (depth: number): z.ZodType<Rule> => {
  const leaves = [completed, minGrade, gradeLevel, coreq, prior, manual] as const;
  if (depth >= MAX_DEPTH) return z.discriminatedUnion("type", leaves) as unknown as z.ZodType<Rule>;
  const child = z.lazy(() => node(depth + 1));
  return z.union([
    z.object({ type: z.literal("all"), rules: z.array(child).max(20) }),
    z.object({ type: z.literal("any"), rules: z.array(child).max(20) }),
    ...leaves,
  ]) as unknown as z.ZodType<Rule>;
};

export const ruleSchema: z.ZodType<Rule> = node(1);

/** Returns the rule, or `null` when `value` is not a valid rule tree. */
export function parseRule(value: unknown): Rule | null {
  const r = ruleSchema.safeParse(value);
  return r.success ? r.data : null;
}

/** Every course slug a rule refers to. Used to validate edits against the catalog. */
export function ruleSlugs(rule: Rule): string[] {
  if (rule.type === "all" || rule.type === "any") return rule.rules.flatMap(ruleSlugs);
  if (rule.type === "completed" || rule.type === "minGrade" || rule.type === "coreq") return rule.courses;
  return [];
}
