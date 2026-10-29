"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import { cancel, confirm, daysLeft, guardianStart, hashEmail, isActive, signConfirm, verifyConfirm, type DeletionSource, type DeletionStatus } from "./index";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
};
const refresh = () => {
  revalidatePath("/settings");
  revalidatePath("/admin/deletions");
};

const LAST_ADMIN = "You are the only admin. Make someone else an admin before deleting this account.";

/** True when deleting this user would leave the app with no admin. */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (u?.role !== "ADMIN") return false;
  return (await db.user.count({ where: { role: "ADMIN", id: { not: userId } } })) === 0;
}

const openRequest = (userId: string) =>
  db.deletionRequest.findFirst({ where: { userId, status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } }, orderBy: { requestedAt: "desc" } });

/** Step 1: the signed-in person asks. A confirmation link goes to their email. Nothing is deleted yet. */
export async function requestDeletion(): Promise<ActionResult> {
  const user = await requireUser();
  try {
    enforceLimit("deletion", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return fail("Too many requests. Try again later.");
    throw e;
  }
  if (await isLastAdmin(user.id)) return fail(LAST_ADMIN);
  if (await openRequest(user.id)) return fail("You already have a deletion request open.");

  await db.$transaction(async (tx) => {
    const req = await tx.deletionRequest.create({ data: { userId: user.id, emailHash: hashEmail(user.email, secret()), source: "self" satisfies DeletionSource } });
    await notify(tx, [{
      userId: user.id, kind: "DELETION_CONFIRM", title: "Confirm deleting your data",
      body: "Open this link while signed in to confirm. Your data is deleted 14 days after you confirm, and you can cancel until then. If you did not ask for this, ignore it.",
      url: `/settings/delete?token=${signConfirm(req.id, user.id, secret())}`,
    }]);
    await writeAudit({ actor: user, action: "user.deletion_requested", entityType: "DeletionRequest", entityId: req.id }, tx);
  });
  refresh();
  return { ok: true };
}

const token = z.string().min(20).max(600);

/** Step 2: the link from the email. Needs the same person signed in, so a forwarded link does nothing. */
export async function confirmDeletion(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const t = token.safeParse(input);
  if (!t.success) return fail("That link is not valid.");
  const v = verifyConfirm(t.data, secret());
  if (!v || v.userId !== user.id) return fail("That link is not valid, or it expired. Request deletion again from Settings.");
  if (await isLastAdmin(user.id)) return fail(LAST_ADMIN);

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const req = await tx.deletionRequest.findFirst({ where: { id: v.requestId, userId: user.id } });
    if (!req) return fail("That link is not valid.");
    const step = confirm({ status: req.status as DeletionStatus, source: req.source as DeletionSource, scheduledFor: req.scheduledFor }, now);
    if (!step.ok) return fail(step.error);
    // The status in the where clause makes a double click a no-op.
    const moved = await tx.deletionRequest.updateMany({ where: { id: req.id, status: "AWAITING_CONFIRMATION" }, data: { status: step.status, confirmedAt: now, scheduledFor: step.scheduledFor } });
    if (moved.count === 0) return fail("This request is no longer open.");
    await notify(tx, [{
      userId: user.id, kind: "DELETION_SCHEDULED", title: "Your data will be deleted",
      body: `Deletion is scheduled in ${daysLeft(step.scheduledFor!, now)} days. You can cancel any time before then in Settings.`,
      url: "/settings",
    }]);
    await writeAudit({ actor: user, action: "user.deletion_scheduled", entityType: "DeletionRequest", entityId: req.id }, tx);
    return { ok: true } as ActionResult;
  });
  refresh();
  return result;
}

/** The person cancels their own request, at either step. A guardian request needs an admin. */
export async function cancelDeletion(): Promise<ActionResult> {
  const user = await requireUser();
  const req = await openRequest(user.id);
  if (!req) return fail("There is nothing to cancel.");
  const step = cancel({ status: req.status as DeletionStatus, source: req.source as DeletionSource, scheduledFor: req.scheduledFor }, "owner");
  if (!step.ok) return fail(step.error);
  await db.$transaction(async (tx) => {
    await tx.deletionRequest.updateMany({ where: { id: req.id, userId: user.id, status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), scheduledFor: null } });
    await writeAudit({ actor: user, action: "user.deletion_cancelled", entityType: "DeletionRequest", entityId: req.id }, tx);
  });
  refresh();
  return { ok: true };
}

const email = z.string().trim().toLowerCase().email().max(254);

/**
 * An admin records a request from a parent or guardian. The admin has checked who is asking, so there is
 * no email step. The student is told, and the 14 days still apply.
 */
export async function recordGuardianRequest(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const e = email.safeParse(input);
  if (!e.success) return fail("Enter a valid email address.");
  const target = await db.user.findFirst({ where: { OR: [{ email: e.data }, { linkedEmails: { some: { email: e.data } } }] }, select: { id: true, email: true } });
  if (!target) return fail("No account uses that email.");
  if (await isLastAdmin(target.id)) return fail("That is the only admin account.");
  if (await openRequest(target.id)) return fail("That account already has a deletion request open.");

  const now = new Date();
  const start = guardianStart(now);
  await db.$transaction(async (tx) => {
    const req = await tx.deletionRequest.create({
      data: { userId: target.id, emailHash: hashEmail(target.email, secret()), source: "guardian", status: start.status, confirmedAt: now, scheduledFor: start.scheduledFor },
    });
    await notify(tx, [{
      userId: target.id, kind: "DELETION_SCHEDULED", title: "A guardian asked to delete your data",
      body: `Your data will be deleted in ${daysLeft(start.scheduledFor, now)} days. Contact the person who runs this site if that is a mistake.`,
      url: "/settings",
    }]);
    await writeAudit({ actor, action: "user.deletion_guardian_recorded", entityType: "DeletionRequest", entityId: req.id }, tx);
  });
  refresh();
  return { ok: true };
}

/** An admin cancels any open request. */
export async function adminCancelDeletion(requestId: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const id = z.string().min(1).max(64).safeParse(requestId);
  if (!id.success) return fail("Request not found.");
  const req = await db.deletionRequest.findUnique({ where: { id: id.data } });
  if (!req || !isActive(req as { status: DeletionStatus })) return fail("There is nothing to cancel.");
  await db.$transaction(async (tx) => {
    await tx.deletionRequest.updateMany({ where: { id: req.id, status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), scheduledFor: null } });
    await writeAudit({ actor, action: "user.deletion_cancelled_by_admin", entityType: "DeletionRequest", entityId: req.id }, tx);
  });
  refresh();
  return { ok: true };
}
