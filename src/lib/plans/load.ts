import { db } from "@/lib/db";
import type { PickerCourse } from "@/lib/catalog/filter";
import { parseRule, type Rule } from "@/lib/eligibility";
import type { RequirementKind } from "@/lib/requirements";
import type { EntryView } from "./view";

function present(plan: NonNullable<Awaited<ReturnType<typeof findPlan>>>) {
  const entries: EntryView[] = plan.entries.map((e) => ({
    id: e.id,
    courseId: e.courseId,
    slug: e.course.slug,
    name: e.course.name,
    department: e.course.department,
    level: e.course.level,
    duration: e.course.duration,
    gradeLevel: e.gradeLevel,
    status: e.status,
    grade: e.grade,
    credits: Number(e.credits),
    courseCredits: Number(e.course.credits),
    gradesOffered: e.course.gradesOffered,
    tags: e.course.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional })),
    rules: parseRule(e.course.rules),
    prereqText: e.course.prereqText,
    approvedAppeal: e.overrideAppealId !== null,
  }));
  return { plan: { id: plan.id, name: plan.name, isPrimary: plan.isPrimary, status: plan.status, ownerId: plan.ownerId }, entries };
}

const findPlan = (where: { id: string; ownerId?: string }) =>
  db.plan.findFirst({
    where,
    include: { entries: { include: { course: { include: { requirements: true } } }, orderBy: [{ gradeLevel: "asc" }, { createdAt: "asc" }] } },
  });

/** The owner's plan with its entries, or null. Ownership is part of the query. */
export async function loadOwnedPlan(planId: string, ownerId: string) {
  const plan = await findPlan({ id: planId, ownerId });
  return plan ? present(plan) : null;
}

/** Any plan, for the counselor and admin read-only view. Callers must check the role first. */
export async function loadPlanForReview(planId: string) {
  const plan = await findPlan({ id: planId });
  return plan ? present(plan) : null;
}

/** Everything the add-course panel can search, as a slim list. */
export async function loadPickerCourses(): Promise<(PickerCourse & { tags: { kind: RequirementKind; credits: number; provisional: boolean }[]; courseCredits: number; rules: Rule | null; prereqText: string | null })[]> {
  const rows = await db.course.findMany({
    where: { archived: false, plannable: true },
    orderBy: { name: "asc" },
    include: { interests: { select: { slug: true } }, requirements: true },
  });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    department: c.department,
    level: c.level,
    duration: c.duration,
    credits: Number(c.credits),
    courseCredits: Number(c.credits),
    gradesOffered: c.gradesOffered,
    interests: c.interests.map((i) => i.slug),
    tags: c.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional })),
    rules: parseRule(c.rules),
    prereqText: c.prereqText,
  }));
}
