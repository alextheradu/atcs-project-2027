/** Plan review rules. Pure, no framework imports. */

export type PlanStatus = "DRAFT" | "SUBMITTED" | "CHANGES_REQUESTED" | "APPROVED";

const NEXT: Record<PlanStatus, PlanStatus[]> = {
  DRAFT: ["SUBMITTED"],
  // The student can take a submitted plan back before it is decided.
  SUBMITTED: ["CHANGES_REQUESTED", "APPROVED", "DRAFT"],
  CHANGES_REQUESTED: ["SUBMITTED", "DRAFT"],
  // Changing an approved plan means reopening it, which clears the approval.
  APPROVED: ["DRAFT"],
};

export const canTransition = (from: PlanStatus, to: PlanStatus) => NEXT[from].includes(to);
/** Submitted and approved plans are read-only for the student. Changes requested opens it again. */
export const isReadOnly = (s: PlanStatus) => s === "SUBMITTED" || s === "APPROVED";
export const isReviewable = (s: PlanStatus) => s === "SUBMITTED";

export const STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

interface Actor {
  id: string;
  role: string;
}

/** Counselors and admins review. Supervisors review appeals, not whole plans. */
export const canReviewPlans = (a: Actor) => a.role === "COUNSELOR" || a.role === "ADMIN";

/** The owner and plan reviewers can comment. Nobody else. */
export const canComment = (a: Actor, ownerId: string) => a.id === ownerId || canReviewPlans(a);

/** Only the owner changes the plan. Staff, including admins, read it. */
export const canEditPlan = (a: Actor, ownerId: string, status: PlanStatus) => a.id === ownerId && !isReadOnly(status);

/** Who is told about a comment: the other side of the conversation. */
export const commentAudience = (a: Actor, ownerId: string): "owner" | "reviewers" => (a.id === ownerId ? "reviewers" : "owner");

export const MAX_COMMENT = 1000;
