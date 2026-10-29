"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import {
  MAX_ENTRIES_PER_PLAN, MAX_PLANS, addEntrySchema, id, isEditable, moveEntrySchema, nextPlanName, planName,
  updateEntrySchema,
} from "./schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const NOT_FOUND = "Plan not found.";
const READ_ONLY = "This plan was submitted for review, so it cannot be changed right now.";

function refresh(planId?: string) {
  revalidatePath("/plans");
  if (planId) revalidatePath(`/plans/${planId}`);
}

/** The owner's plan or null. Ownership lives in the query, so another student's plan is just "not found". */
const ownedPlan = (planId: string, ownerId: string) => db.plan.findFirst({ where: { id: planId, ownerId } });
const ownedEntry = (entryId: string, ownerId: string) =>
  db.planEntry.findFirst({ where: { id: entryId, plan: { ownerId } }, include: { plan: true } });

function limited(userId: string): ActionResult | null {
  try {
    enforceLimit("plan", userId);
    return null;
  } catch (e) {
    if (e instanceof RateLimitError) return fail("You are creating plans too quickly. Try again in a few minutes.");
    throw e;
  }
}

export async function createPlan(name?: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const tooFast = limited(user.id);
  if (tooFast) return tooFast;

  const existing = await db.plan.findMany({ where: { ownerId: user.id }, select: { name: true } });
  if (existing.length >= MAX_PLANS) return fail(`You can have up to ${MAX_PLANS} plans. Delete one first.`);

  const parsed = name === undefined || name === "" ? { success: true as const, data: nextPlanName(existing.map((p) => p.name)) } : planName.safeParse(name);
  if (!parsed.success) return fail("Give the plan a name (60 characters max).");

  const plan = await db.plan.create({
    data: { ownerId: user.id, name: parsed.data, isPrimary: existing.length === 0 },
    select: { id: true },
  });
  refresh();
  return { ok: true, data: { id: plan.id } };
}

export async function renamePlan(planId: unknown, name: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const pid = id.safeParse(planId);
  const n = planName.safeParse(name);
  if (!pid.success || !n.success) return fail("Give the plan a name (60 characters max).");
  const plan = await ownedPlan(pid.data, user.id);
  if (!plan) return fail(NOT_FOUND);
  if (!isEditable(plan.status)) return fail(READ_ONLY);
  await db.plan.update({ where: { id: plan.id }, data: { name: n.data } });
  refresh(plan.id);
  return { ok: true };
}

export async function clonePlan(planId: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const pid = id.safeParse(planId);
  if (!pid.success) return fail(NOT_FOUND);
  const tooFast = limited(user.id);
  if (tooFast) return tooFast;

  const source = await db.plan.findFirst({ where: { id: pid.data, ownerId: user.id }, include: { entries: true } });
  if (!source) return fail(NOT_FOUND);
  const count = await db.plan.count({ where: { ownerId: user.id } });
  if (count >= MAX_PLANS) return fail(`You can have up to ${MAX_PLANS} plans. Delete one first.`);

  const copy = await db.$transaction(async (tx) => {
    const created = await tx.plan.create({
      data: { ownerId: user.id, name: `${source.name} copy`.slice(0, 60), isPrimary: false },
      select: { id: true },
    });
    if (source.entries.length > 0) {
      await tx.planEntry.createMany({
        data: source.entries.map((e) => ({
          planId: created.id, courseId: e.courseId, gradeLevel: e.gradeLevel, status: e.status, grade: e.grade,
          credits: e.credits, source: e.source, note: e.note,
        })),
      });
    }
    return created;
  });
  refresh();
  return { ok: true, data: { id: copy.id } };
}

export async function deletePlan(planId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const pid = id.safeParse(planId);
  if (!pid.success) return fail(NOT_FOUND);
  const plan = await ownedPlan(pid.data, user.id);
  if (!plan) return fail(NOT_FOUND);
  if (plan.status === "SUBMITTED") return fail("Withdraw the plan from review before deleting it.");

  await db.$transaction(async (tx) => {
    await tx.plan.delete({ where: { id: plan.id } });
    if (plan.isPrimary) {
      const next = await tx.plan.findFirst({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true } });
      if (next) await tx.plan.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });
  refresh();
  return { ok: true };
}

/** One transaction: clear the old primary first so the partial unique index is never violated. */
export async function setPrimaryPlan(planId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const pid = id.safeParse(planId);
  if (!pid.success) return fail(NOT_FOUND);
  const plan = await ownedPlan(pid.data, user.id);
  if (!plan) return fail(NOT_FOUND);

  await db.$transaction(async (tx) => {
    await tx.plan.updateMany({ where: { ownerId: user.id, isPrimary: true }, data: { isPrimary: false } });
    await tx.plan.update({ where: { id: plan.id }, data: { isPrimary: true } });
  });
  refresh();
  return { ok: true };
}

export async function addEntry(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const p = addEntrySchema.safeParse(input);
  if (!p.success) return fail("Pick a course and a grade from 9 to 12.");
  const { planId, courseId, gradeLevel } = p.data;

  const plan = await ownedPlan(planId, user.id);
  if (!plan) return fail(NOT_FOUND);
  if (!isEditable(plan.status)) return fail(READ_ONLY);

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.archived || !course.plannable) return fail("That course is not available.");

  if (await db.planEntry.findFirst({ where: { planId, courseId }, select: { id: true } })) {
    return fail(`${course.name} is already in this plan.`);
  }
  if ((await db.planEntry.count({ where: { planId } })) >= MAX_ENTRIES_PER_PLAN) {
    return fail(`A plan can hold up to ${MAX_ENTRIES_PER_PLAN} courses.`);
  }

  try {
    // A course a supervisor already approved reads "Approved via appeal" from the start.
    const approved = await db.appeal.findFirst({ where: { studentId: user.id, targetCourseId: courseId, status: "APPROVED" }, select: { id: true } });
    const entry = await db.planEntry.create({
      data: { planId, courseId, gradeLevel, credits: course.credits, status: "PLANNED", source: "MANUAL", overrideAppealId: approved?.id ?? null },
      select: { id: true },
    });
    await db.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    refresh(planId);
    return { ok: true, data: { id: entry.id } };
  } catch (e) {
    // Two quick clicks can race past the check above; the unique index is the real guard.
    if ((e as { code?: string }).code === "P2002") return fail(`${course.name} is already in this plan.`);
    throw e;
  }
}

export async function moveEntry(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = moveEntrySchema.safeParse(input);
  if (!p.success) return fail("Pick a grade from 9 to 12.");
  const entry = await ownedEntry(p.data.entryId, user.id);
  if (!entry) return fail(NOT_FOUND);
  if (!isEditable(entry.plan.status)) return fail(READ_ONLY);
  await db.planEntry.update({ where: { id: entry.id }, data: { gradeLevel: p.data.gradeLevel } });
  refresh(entry.planId);
  return { ok: true };
}

export async function removeEntry(entryId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const eid = id.safeParse(entryId);
  if (!eid.success) return fail(NOT_FOUND);
  const entry = await ownedEntry(eid.data, user.id);
  if (!entry) return fail(NOT_FOUND);
  if (!isEditable(entry.plan.status)) return fail(READ_ONLY);
  await db.planEntry.delete({ where: { id: entry.id } });
  refresh(entry.planId);
  return { ok: true };
}

export async function updateEntry(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = updateEntrySchema.safeParse(input);
  if (!p.success) return fail("That value is not allowed.");
  const entry = await ownedEntry(p.data.entryId, user.id);
  if (!entry) return fail(NOT_FOUND);
  if (!isEditable(entry.plan.status)) return fail(READ_ONLY);

  const status = p.data.status ?? entry.status;
  const data: Record<string, unknown> = {};
  if (p.data.status) data.status = p.data.status;
  // A grade only makes sense once the course is completed.
  if (status !== "COMPLETED") data.grade = null;
  else if (p.data.grade !== undefined) data.grade = p.data.grade;
  if (p.data.credits !== undefined) data.credits = p.data.credits;

  await db.planEntry.update({ where: { id: entry.id }, data });
  refresh(entry.planId);
  return { ok: true };
}
