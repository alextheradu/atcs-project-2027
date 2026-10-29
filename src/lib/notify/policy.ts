/** Notification rules: which channels, how to retry, what to hide in logs. Pure. */

export const KINDS = [
  "APPEAL_SUBMITTED", "APPEAL_ASSIGNED", "APPEAL_DECIDED", "PLAN_SUBMITTED", "PLAN_CHANGES_REQUESTED", "PLAN_APPROVED",
  "PLAN_COMMENT", "ROLE_CHANGED", "DELETION_CONFIRM", "DELETION_SCHEDULED", "TIMELINE_REMINDER", "SYSTEM",
] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  APPEAL_SUBMITTED: "A placement review request arrives (reviewers)",
  APPEAL_ASSIGNED: "A placement review is started",
  APPEAL_DECIDED: "A placement review is decided",
  PLAN_SUBMITTED: "A plan is sent for review (counselors)",
  PLAN_CHANGES_REQUESTED: "A counselor asks for changes",
  PLAN_APPROVED: "A plan is approved",
  PLAN_COMMENT: "Someone comments on a plan",
  ROLE_CHANGED: "Your role changes",
  DELETION_CONFIRM: "Confirm deleting your data",
  DELETION_SCHEDULED: "Your data deletion is scheduled",
  TIMELINE_REMINDER: "A date is coming up",
  SYSTEM: "Other messages",
};

/** Email is on by default for decisions and account changes. Push is always opt in. */
const EMAIL_DEFAULT: Kind[] = ["APPEAL_DECIDED", "PLAN_CHANGES_REQUESTED", "PLAN_APPROVED", "ROLE_CHANGED", "DELETION_CONFIRM", "DELETION_SCHEDULED"];
/** Account safety messages cannot be turned off by email. */
const EMAIL_LOCKED: Kind[] = ["DELETION_CONFIRM", "DELETION_SCHEDULED"];

export interface Pref {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export const defaultPref = (kind: Kind): Pref => ({ inApp: true, email: EMAIL_DEFAULT.includes(kind), push: false });
export const isEmailLocked = (kind: Kind) => EMAIL_LOCKED.includes(kind);

/** The delivery channels to queue for a kind, from the saved preference or the defaults. In-app is the notification itself. */
export function channelsFor(kind: Kind, saved: Pref | null | undefined): ("EMAIL" | "PUSH")[] {
  const p = saved ?? defaultPref(kind);
  const out: ("EMAIL" | "PUSH")[] = [];
  if (p.email || isEmailLocked(kind)) out.push("EMAIL");
  if (p.push) out.push("PUSH");
  return out;
}

export const MAX_ATTEMPTS = 5;
const BACKOFF_MIN = [1, 5, 15, 60, 360];

/**
 * What happens after a failed send. `attempts` is the count including the one that just failed.
 * Retries back off from 1 minute to 6 hours, then the delivery stops as FAILED. A permanent failure
 * (a bad address, an unconfigured provider) stops at once.
 */
export function afterFailure(attempts: number, now: Date, permanent = false): { status: "PENDING" | "FAILED"; nextAttemptAt: Date } {
  if (permanent || attempts >= MAX_ATTEMPTS) return { status: "FAILED", nextAttemptAt: now };
  const minutes = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
  return { status: "PENDING", nextAttemptAt: new Date(now.getTime() + minutes * 60_000) };
}

/** a***@d***.com. Logs never carry a full address. */
export function redactEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const [host = "", ...rest] = domain.split(".");
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${rest.length ? `.${rest[rest.length - 1]}` : ""}`;
}

/** Push payloads stay short and carry no grades or answers. */
export function pushPayload(n: { title: string; body: string; url: string | null }) {
  return JSON.stringify({ title: n.title.slice(0, 80), body: n.body.slice(0, 140), url: n.url && n.url.startsWith("/") ? n.url : "/dashboard" });
}

const STAFF_ONLY: Kind[] = ["APPEAL_SUBMITTED", "PLAN_SUBMITTED"];
const STUDENT_ONLY: Kind[] = ["APPEAL_ASSIGNED", "APPEAL_DECIDED", "PLAN_CHANGES_REQUESTED", "PLAN_APPROVED"];

/** The kinds worth showing in a person's settings, so a student never sees staff options. */
export function kindsFor(role: string): Kind[] {
  const student = role === "STUDENT" || role === "INCOMING";
  return KINDS.filter((k) => (student ? !STAFF_ONLY.includes(k) : !STUDENT_ONLY.includes(k)));
}
