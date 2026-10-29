"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import { id } from "@/lib/plans/schemas";
import { MAX_COMMENT, canComment, canTransition, commentAudience, type PlanStatus } from "./index";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const NOT_FOUND = "Plan not found.";

function refresh(planId: string) {
  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/counselor");
}

/** The student's own plan. Ownership is part of the query. */
const ownPlan = (planId: string, ownerId: string) => db.plan.findFirst({ where: { id: planId, ownerId }, include: { _count: { select: { entries: true } } } });

const comment = z.string().trim().min(1, "Write a comment first.").max(MAX_COMMENT, `Keep comments under ${MAX_COMMENT} characters.`);

/** Counselors and admins, capped so one submission cannot notify the whole school. */
async function reviewerIds() {
  return (await db.user.findMany({ where: { role: { in: ["COUNSELOR", "ADMIN"] } }, select: { id: true }, take: 50 })).map((u) => u.id);
}

async function ownerMove(planId: unknown, to: PlanStatus, action: string, extra: (plan: { id: string; name: string }, tx: typeof db) => Promise<void> = async () => {}): Promise<ActionResult> {
  const user = await requireUser();
  const pid = id.safeParse(planId);
  if (!pid.success) return fail(NOT_FOUND);
  const plan = await ownPlan(pid.data, user.id);
  if (!plan) return fail(NOT_FOUND);
  if (!canTransition(plan.status, to)) return fail(`A ${plan.status.toLowerCase().replace("_", " ")} plan cannot do that.`);
  if (to === "SUBMITTED" && plan._count.entries === 0) return fail("Add at least one course before you send the plan for review.");

  await db.$transaction(async (tx) => {
    await tx.plan.update({
      where: { id: plan.id },
      data: { status: to, ...(to === "SUBMITTED" ? { submittedAt: new Date(), decidedAt: null, reviewerId: null } : {}), ...(to === "DRAFT" ? { decidedAt: null, reviewerId: null } : {}) },
    });
    await extra(plan, tx as unknown as typeof db);
    await writeAudit({ actor: user, action, entityType: "Plan", entityId: plan.id }, tx);
  });
  refresh(plan.id);
  return { ok: true };
}

export async function submitPlan(planId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ids = await reviewerIds();
  return ownerMove(planId, "SUBMITTED", "plan.submitted", async (plan, tx) => {
    await notify(tx, ids.filter((r) => r !== user.id).map((userId) => ({ userId, kind: "SYSTEM" as const, title: "Plan ready for review", body: `${plan.name} was sent for review.`, url: `/counselor/plans/${plan.id}` })));
  });
}

/** Take a submitted plan back before it is decided. */
export async function withdrawPlan(planId: unknown): Promise<ActionResult> {
  return ownerMove(planId, "DRAFT", "plan.withdrawn");
}
/** Reopen an approved plan to change it. The approval is cleared. */
export async function reopenPlan(planId: unknown): Promise<ActionResult> {
  return ownerMove(planId, "DRAFT", "plan.reopened");
}

async function decide(planId: unknown, note: unknown, to: "APPROVED" | "CHANGES_REQUESTED"): Promise<ActionResult> {
  const actor = await requireRole("COUNSELOR", "ADMIN");
  const pid = id.safeParse(planId);
  if (!pid.success) return fail(NOT_FOUND);
  const n = comment.safeParse(note ?? "");
  // Approving needs no note. Asking for changes does, so the student knows what to fix.
  if (to === "CHANGES_REQUESTED" && !n.success) return fail("Say what needs to change.");
  const body = n.success ? n.data : null;

  const plan = await db.plan.findUnique({ where: { id: pid.data }, select: { id: true, name: true, ownerId: true, status: true } });
  if (!plan) return fail(NOT_FOUND);
  if (!canTransition(plan.status, to)) return fail("That plan is not waiting for review.");

  await db.$transaction(async (tx) => {
    await tx.plan.update({ where: { id: plan.id }, data: { status: to, reviewerId: actor.id, decidedAt: new Date() } });
    if (body) await tx.planComment.create({ data: { planId: plan.id, authorId: actor.id, body } });
    await notify(tx, [{
      userId: plan.ownerId, kind: "SYSTEM", title: to === "APPROVED" ? "Plan approved" : "Changes requested on your plan",
      body: to === "APPROVED" ? `${plan.name} was approved.` : `A counselor asked for changes to ${plan.name}. Open it to read the comment.`, url: `/plans/${plan.id}`,
    }]);
    await writeAudit({ actor, action: to === "APPROVED" ? "plan.approved" : "plan.changes_requested", entityType: "Plan", entityId: plan.id }, tx);
  });
  refresh(plan.id);
  return { ok: true };
}

export async function approvePlan(planId: unknown, note?: unknown): Promise<ActionResult> {
  return decide(planId, note, "APPROVED");
}
export async function requestPlanChanges(planId: unknown, note: unknown): Promise<ActionResult> {
  return decide(planId, note, "CHANGES_REQUESTED");
}

/** A comment on a plan or on one entry. The owner and plan reviewers only. Rendered as plain text. */
export async function addComment(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = z.object({ planId: id, entryId: id.nullable().optional(), body: comment }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the comment.");
  try {
    enforceLimit("plan", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return fail("You are commenting too quickly. Try again in a few minutes.");
    throw e;
  }

  const plan = await db.plan.findUnique({ where: { id: p.data.planId }, select: { id: true, name: true, ownerId: true } });
  // Someone with no right to the plan gets the same answer as for a plan that does not exist.
  if (!plan || !canComment(user, plan.ownerId)) return fail(NOT_FOUND);
  if (p.data.entryId && !(await db.planEntry.findFirst({ where: { id: p.data.entryId, planId: plan.id }, select: { id: true } }))) return fail("That course is not in this plan.");

  const toOwner = commentAudience(user, plan.ownerId) === "owner";
  const ids = toOwner ? [plan.ownerId] : await reviewerIds();
  await db.$transaction(async (tx) => {
    await tx.planComment.create({ data: { planId: plan.id, entryId: p.data.entryId ?? null, authorId: user.id, body: p.data.body } });
    await notify(tx, ids.filter((u) => u !== user.id).map((userId) => ({ userId, kind: "SYSTEM" as const, title: "New comment on a plan", body: `There is a new comment on ${plan.name}.`, url: toOwner ? `/plans/${plan.id}` : `/counselor/plans/${plan.id}` })));
  });
  refresh(plan.id);
  return { ok: true };
}
