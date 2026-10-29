import type { db } from "@/lib/db";
import { DELETED_LABEL } from "./index";

type Tx = Pick<typeof db, "user" | "roleGrant" | "importRequest" | "appSetting" | "auditLog" | "$executeRaw">;

/**
 * Removes a person and everything of theirs, in the caller's transaction. The foreign keys do most
 * of it (see USER_REFS). This handles what the database cannot:
 * - role grants and sign-in tokens are keyed by email, not by user id
 * - two staff columns hold a bare id with no foreign key
 * - audit rows stay but lose the person: label, entity pointer, and any copy of the id or an email
 *   inside the before and after snapshots
 */
export async function eraseUser(tx: Tx, userId: string): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, linkedEmails: { select: { email: true } } } });
  if (!user) return false;
  const emails = [...new Set([user.email, ...user.linkedEmails.map((l) => l.email)].map((e) => e.toLowerCase()))];

  // Audit trail first, while the id still matches. Rows stay for accountability, anonymized.
  await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorLabel: DELETED_LABEL } });
  await tx.auditLog.updateMany({ where: { entityId: userId }, data: { entityId: null } });
  const patterns = [userId, ...emails].map((v) => `%${v.replace(/[\\%_]/g, "\\$&")}%`);
  await tx.$executeRaw`UPDATE "AuditLog" SET "before" = NULL, "after" = NULL
    WHERE "before"::text ILIKE ANY(${patterns}::text[]) OR "after"::text ILIKE ANY(${patterns}::text[])`;
  // Labels are a name or an email. An email is unique to the person. A name only counts on rows whose
  // actor link is already gone, so a namesake's rows are left alone.
  await tx.auditLog.updateMany({ where: { actorLabel: { in: emails, mode: "insensitive" } }, data: { actorLabel: DELETED_LABEL } });
  if (user.name) await tx.auditLog.updateMany({ where: { actorId: null, actorLabel: user.name }, data: { actorLabel: DELETED_LABEL } });

  // Bare id columns with no foreign key.
  await tx.importRequest.updateMany({ where: { decidedById: userId }, data: { decidedById: null } });
  await tx.appSetting.updateMany({ where: { updatedById: userId }, data: { updatedById: null } });

  // Keyed by email: a leftover grant would hand the role back on the next sign-in.
  await tx.roleGrant.deleteMany({ where: { email: { in: emails } } });
  await tx.$executeRaw`DELETE FROM "VerificationToken" WHERE lower("identifier") = ANY(${emails}::text[])`;

  // The user row. Sessions, accounts, profile, plans, entries, appeals, answers, notifications,
  // preferences, push subscriptions and acceptances go with it by cascade.
  await tx.user.delete({ where: { id: userId } });
  return true;
}

