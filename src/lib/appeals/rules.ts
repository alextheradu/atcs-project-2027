/** Appeal rules: status machine, submission windows, reviewer scope. Pure, no framework imports. */

export type AppealStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "DENIED" | "WITHDRAWN";

const NEXT: Record<AppealStatus, AppealStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "DENIED", "WITHDRAWN"],
  UNDER_REVIEW: ["APPROVED", "DENIED", "WITHDRAWN"],
  APPROVED: [],
  DENIED: [],
  WITHDRAWN: [],
};

export const canTransition = (from: AppealStatus, to: AppealStatus) => NEXT[from].includes(to);
/** The student can change answers only while it is a draft. */
export const isEditable = (s: AppealStatus) => s === "DRAFT";
/** Withdrawing is possible any time before a decision, once submitted. */
export const isWithdrawable = (s: AppealStatus) => s === "SUBMITTED" || s === "UNDER_REVIEW";
export const isDecidable = (s: AppealStatus) => s === "SUBMITTED" || s === "UNDER_REVIEW";
export const isOpen = (s: AppealStatus) => s === "SUBMITTED" || s === "UNDER_REVIEW";

export const STATUS_LABEL: Record<AppealStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

export interface WindowEvent {
  id: string;
  kind: string;
  audience: "CURRENT" | "INCOMING" | "ALL";
  label: string;
  opensAt: Date;
  closesAt: Date | null;
}

export interface WindowCheck {
  allowed: boolean;
  /** The open window, when there is one. */
  window: WindowEvent | null;
  /** Start of the next window, for the "opens on" message. */
  nextOpen: Date | null;
}

const forAudience = (e: WindowEvent, role: "STUDENT" | "INCOMING") => e.kind === "APPEAL_WINDOW" && (e.audience === "ALL" || e.audience === (role === "INCOMING" ? "INCOMING" : "CURRENT"));

/**
 * Current students can submit any time. Incoming 8th graders only inside an open APPEAL_WINDOW for their
 * audience. A window with no end date stays open once it starts.
 */
export function checkWindow(role: "STUDENT" | "INCOMING", events: WindowEvent[], now = new Date()): WindowCheck {
  const mine = events.filter((e) => forAudience(e, role));
  const open = mine.find((e) => e.opensAt.getTime() <= now.getTime() && (e.closesAt === null || e.closesAt.getTime() >= now.getTime())) ?? null;
  const next = mine.map((e) => e.opensAt).filter((d) => d.getTime() > now.getTime()).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  return { allowed: role === "STUDENT" || open !== null, window: open, nextOpen: next };
}

interface Actor {
  id: string;
  role: string;
  departments: readonly string[];
}

/** Supervisors decide appeals in their own departments. Admins decide any. Nobody else decides. */
export function canReview(actor: Actor, department: string): boolean {
  if (actor.role === "ADMIN") return true;
  return actor.role === "SUPERVISOR" && actor.departments.includes(department);
}

/** A student reads only their own appeal. Reviewers read the ones they may decide. */
export function canView(actor: Actor, appeal: { studentId: string; department: string }): boolean {
  return actor.id === appeal.studentId || canReview(actor, appeal.department);
}

export interface UnmetItem {
  type: string;
  message: string;
}

/** What the student was missing when they asked, kept with the appeal. */
export function snapshotUnmet(leaves: { rule: { type: string }; message: string }[]): UnmetItem[] {
  return leaves.slice(0, 12).map((l) => ({ type: l.rule.type, message: l.message.slice(0, 300) }));
}
