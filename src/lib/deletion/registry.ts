/**
 * Every place the database points at a user, and what happens to it when that user is deleted.
 * The registry test reads prisma/schema.prisma and fails when a new user column is missing here,
 * so a new feature cannot quietly keep data after a deletion or leave it out of the export.
 */

/** The sections of the data export. The export module must build every one of them. */
export const EXPORT_KEYS = [
  "account", "linkedEmails", "signIns", "profile", "onboarding", "policyAcceptances", "plans", "comments",
  "appeals", "importRequests", "notifications", "notificationPreferences", "pushDevices", "deletionRequests",
  "auditTrail", "staffActivity",
] as const;
export type ExportKey = (typeof EXPORT_KEYS)[number];

export type Handling =
  /** The row belongs to the user and is deleted with them by the database. */
  | "cascade"
  /** The row belongs to someone else. The pointer is cleared and the row stays. */
  | "setNull"
  /** A plain id column with no foreign key. The delete code clears it by hand. */
  | "scrub";

export interface UserRef {
  how: Handling;
  /** Where the export reports it. */
  export: ExportKey;
  note?: string;
}

export const USER_REFS: Record<string, UserRef> = {
  "Account.userId": { how: "cascade", export: "signIns", note: "Google tokens are never exported." },
  "Session.userId": { how: "cascade", export: "signIns" },
  "LinkedEmail.userId": { how: "cascade", export: "linkedEmails" },
  "RoleGrant.createdById": { how: "setNull", export: "staffActivity" },
  "PolicyAcceptance.userId": { how: "cascade", export: "policyAcceptances" },
  "OnboardingProgress.userId": { how: "cascade", export: "onboarding" },
  "StudentProfile.userId": { how: "cascade", export: "profile" },
  "CourseAlias.createdById": { how: "setNull", export: "staffActivity" },
  "ImportRequest.studentId": { how: "cascade", export: "importRequests" },
  "ImportRequest.decidedById": { how: "scrub", export: "staffActivity" },
  "Plan.ownerId": { how: "cascade", export: "plans" },
  "Plan.reviewerId": { how: "setNull", export: "staffActivity" },
  "PlanComment.authorId": { how: "setNull", export: "comments", note: "Staff comments stay on the student's plan, shown as a deleted user." },
  "Appeal.studentId": { how: "cascade", export: "appeals" },
  "Appeal.decidedById": { how: "setNull", export: "staffActivity", note: "Decisions stay, shown as a deleted user." },
  "AppSetting.updatedById": { how: "scrub", export: "staffActivity" },
  "Notification.userId": { how: "cascade", export: "notifications" },
  "NotificationPreference.userId": { how: "cascade", export: "notificationPreferences" },
  "PushSubscription.userId": { how: "cascade", export: "pushDevices", note: "Keys are never exported." },
  "DeletionRequest.userId": { how: "setNull", export: "deletionRequests", note: "Keeps only the email hash." },
  "AuditLog.actorId": { how: "setNull", export: "auditTrail", note: "The actor label is rewritten to the deleted user label." },
};

/** Columns the schema test treats as pointing at a user even without a relation. */
export const USER_COLUMN_PATTERN = /^(user|student|owner|reviewer|author|actor|createdBy|decidedBy|updatedBy)Id$/;

/** Models that hold a person's email, so deletion clears them by address. */
export const EMAIL_KEYED_MODELS = ["RoleGrant.email", "VerificationToken.identifier", "LinkedEmail.email"] as const;
