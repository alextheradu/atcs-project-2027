import { createHmac, timingSafeEqual } from "node:crypto";

/** Pure rules for deleting an account. No database, no framework. */

export const GRACE_DAYS = 14;
export const CONFIRM_TTL_MS = 24 * 60 * 60_000;
export const DELETED_LABEL = "deleted user";

export type DeletionStatus = "AWAITING_CONFIRMATION" | "SCHEDULED" | "CANCELLED" | "COMPLETED";
export type DeletionSource = "self" | "guardian";

export interface DeletionState {
  status: DeletionStatus;
  source: DeletionSource;
  scheduledFor: Date | null;
}

const DAY = 86_400_000;

/** A request still in play: waiting for the email link, or counting down. */
export const isActive = (s: { status: DeletionStatus }) => s.status === "AWAITING_CONFIRMATION" || s.status === "SCHEDULED";

/** When a request confirmed at `now` will run. */
export const scheduleFrom = (now: Date) => new Date(now.getTime() + GRACE_DAYS * DAY);

export type Step = { ok: true; status: DeletionStatus; scheduledFor: Date | null } | { ok: false; error: string };

/** The student followed the email link. */
export function confirm(s: DeletionState, now: Date): Step {
  if (s.status === "SCHEDULED") return { ok: false, error: "Deletion is already scheduled." };
  if (s.status !== "AWAITING_CONFIRMATION") return { ok: false, error: "This request is no longer open." };
  return { ok: true, status: "SCHEDULED", scheduledFor: scheduleFrom(now) };
}

/**
 * Cancel during the grace period. The person can cancel their own request. A request an admin recorded
 * for a guardian can only be cancelled by an admin, because the guardian is the one who asked.
 */
export function cancel(s: DeletionState, by: "owner" | "admin"): Step {
  if (!isActive(s)) return { ok: false, error: "There is nothing to cancel." };
  if (s.source === "guardian" && by === "owner") return { ok: false, error: "A guardian asked for this. Ask an admin to cancel it." };
  return { ok: true, status: "CANCELLED", scheduledFor: null };
}

/** True when a confirmed request has reached the end of its grace period. */
export const isDue = (s: DeletionState, now: Date) => s.status === "SCHEDULED" && s.scheduledFor !== null && s.scheduledFor.getTime() <= now.getTime();

/** A guardian request skips the email step. An admin checks who is asking before recording it. */
export const guardianStart = (now: Date): { status: DeletionStatus; scheduledFor: Date } => ({ status: "SCHEDULED", scheduledFor: scheduleFrom(now) });

/** Normalized so the same address always hashes the same. Keyed, so the hash cannot be looked up from a list of emails. */
export function hashEmail(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`deletion:${email.trim().toLowerCase()}`).digest("hex");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`deletion-confirm:${payload}`).digest("base64url");
}

/** The token in the confirmation email. It names the request and the user, and expires. */
export function signConfirm(requestId: string, userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ r: requestId, u: userId, exp: now + CONFIRM_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyConfirm(token: string, secret: string, now = Date.now()): { requestId: string; userId: string } | null {
  if (token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { r?: unknown; u?: unknown; exp?: unknown };
    if (typeof d.r !== "string" || typeof d.u !== "string" || typeof d.exp !== "number" || d.exp < now) return null;
    return { requestId: d.r, userId: d.u };
  } catch {
    return null;
  }
}

/** Whole days left, never negative, for the "deleted on" notice. */
export const daysLeft = (scheduledFor: Date, now: Date) => Math.max(0, Math.ceil((scheduledFor.getTime() - now.getTime()) / DAY));
