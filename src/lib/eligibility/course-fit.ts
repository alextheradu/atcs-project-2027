/** How one catalog course fits a student's plan, grade by grade. Pure. */
import { buildContext, type PlanCourse, type StudentPrior } from "./plan";
import { evaluateCourse } from "./evaluate";
import type { EvalResult, Rule } from "./types";

export interface GradeFit {
  grade: number;
  result: EvalResult;
}

export function courseFit(
  course: { slug: string; gradesOffered: number[]; rules: Rule | null; prereqText: string | null },
  plan: PlanCourse[],
  opts: { prior?: StudentPrior; names?: Record<string, string> } = {},
): GradeFit[] {
  const own = plan.find((p) => p.slug === course.slug);
  const others = plan.filter((p) => p.slug !== course.slug);
  const grades = course.gradesOffered.filter((g) => g >= 9 && g <= 12);
  return grades.map((grade) => ({
    grade,
    result: evaluateCourse(course, buildContext(grade, others, { ...opts, approvedAppeal: own?.approvedAppeal })),
  }));
}
