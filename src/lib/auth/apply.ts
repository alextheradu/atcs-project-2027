import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Department, PolicyResult, Role } from "./policy";

/** Applies grants and the ADMIN_EMAILS bootstrap to a user who already exists. */
export async function applyToExistingUser(userId: string, email: string, result: Extract<PolicyResult, { allow: true }>) {
  if (!result.role) return;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role === result.role) return;

  if (result.source === "admin_env") {
    // Bootstrap only: never re-promote after an admin deliberately changed this role.
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins > 0) return;
  }

  await db.$transaction(async (tx) => {
    const after = await tx.user.update({
      where: { id: userId },
      data: { role: result.role as Role, departments: result.departments as Department[] },
    });
    if (result.source === "grant") {
      await tx.roleGrant.updateMany({ where: { email, appliedAt: null }, data: { appliedAt: new Date() } });
    }
    await writeAudit(
      {
        actor: null,
        action: `user.role_applied_${result.source}`,
        entityType: "User",
        entityId: userId,
        before: { role: user.role, departments: user.departments },
        after: { role: after.role, departments: after.departments },
      },
      tx,
    );
  });
}

