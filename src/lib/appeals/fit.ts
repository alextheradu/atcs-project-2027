import { courseFit, parseRule, type EvalResult, type PlanCourse } from "@/lib/eligibility";
import { bestFit } from "@/lib/pathways";
import { db } from "@/lib/db";

/** How a course fits the student's primary plan, at the grade where it fits best. Null when no 9 to 12 grade offers it. */
export async function bestFitOf(
  userId: string,
  course: { slug: string; gradesOffered: number[]; rules: unknown; prereqText: string | null },
): Promise<EvalResult | null> {
  const [plan, profile] = await Promise.all([
    db.plan.findFirst({ where: { ownerId: userId, isPrimary: true }, include: { entries: { include: { course: { select: { slug: true, name: true } } } } } }),
    db.studentProfile.findUnique({ where: { userId }, select: { eighthMath: true, eighthMathGrade: true } }),
  ]);
  const rules = parseRule(course.rules);
  const placements: PlanCourse[] = (plan?.entries ?? []).map((e) => ({
    key: e.id, slug: e.course.slug, name: e.course.name, gradeLevel: e.gradeLevel, status: e.status, grade: e.grade,
    rules: null, prereqText: null, approvedAppeal: e.overrideAppealId !== null,
  }));
  const names = Object.fromEntries(placements.map((p) => [p.slug, p.name]));
  return bestFit(courseFit({ slug: course.slug, gradesOffered: course.gradesOffered, rules, prereqText: course.prereqText }, placements, { prior: profile ?? {}, names }))?.result ?? null;
}
