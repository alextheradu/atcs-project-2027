"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { canDemoteAdmin } from "@/lib/auth/guards";
import { STAFF_DOMAIN, emailDomain, isStaffRole, type Role } from "@/lib/auth/policy";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { changeRoleSchema, createGrantSchema, searchSchema } from "./schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function staffEmailError(email: string, role: Role): string | null {
  if (isStaffRole(role) && emailDomain(email) !== STAFF_DOMAIN) {
    return `Staff roles can only be given to @${STAFF_DOMAIN} addresses.`;
  }
  return null;
}

export async function searchUsers(query: string) {
  await requireRole("ADMIN");
  const q = searchSchema.parse(query);
  return db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, email: true, role: true, departments: true, createdAt: true },
  });
}

export async function changeUserRole(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");
  const { userId, role } = parsed.data;
  const departments = role === "SUPERVISOR" ? parsed.data.departments : [];
  if (role === "SUPERVISOR" && departments.length === 0) return fail("Pick at least one department for a supervisor.");

  const result = await db.$transaction(
    async (tx): Promise<ActionResult> => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) return fail("User not found.");

      if (target.role !== role) {
        const err = staffEmailError(target.email, role);
        if (err) return fail(err);
      }
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (!canDemoteAdmin({ adminCount, targetIsAdmin: target.role === "ADMIN", newRole: role })) {
        return fail("You cannot remove the last admin.");
      }

      const after = await tx.user.update({ where: { id: userId }, data: { role, departments } });
      await writeAudit(
        {
          actor,
          action: "user.role_changed",
          entityType: "User",
          entityId: userId,
          before: { role: target.role, departments: target.departments },
          after: { role: after.role, departments: after.departments },
        },
        tx,
      );
      if (after.role !== target.role) {
        await notify(tx, [{ userId, kind: "ROLE_CHANGED", title: "Your role changed", body: "An admin changed your role in the course planner. Sign in again if something looks different.", url: "/dashboard" }]);
      }
      return { ok: true };
    },
    { isolationLevel: "Serializable" },
  );

  if (result.ok) revalidatePath("/admin/users");
  return result;
}

export async function createGrant(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const parsed = createGrantSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email and role.");
  const { email, role } = parsed.data;
  const departments = role === "SUPERVISOR" ? parsed.data.departments : [];
  if (role === "SUPERVISOR" && departments.length === 0) return fail("Pick at least one department for a supervisor.");
  const err = staffEmailError(email, role);
  if (err) return fail(err);

  const result = await db.$transaction(async (tx): Promise<ActionResult> => {
    const existingUser = await tx.user.findUnique({ where: { email } });
    const grant = await tx.roleGrant.upsert({
      where: { email },
      create: { email, role, departments, createdById: actor.id, appliedAt: existingUser ? new Date() : null },
      update: { role, departments, createdById: actor.id, appliedAt: existingUser ? new Date() : null },
    });
    if (existingUser) {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (!canDemoteAdmin({ adminCount, targetIsAdmin: existingUser.role === "ADMIN", newRole: role })) {
        throw new Error("last_admin");
      }
      await tx.user.update({ where: { id: existingUser.id }, data: { role, departments } });
    }
    await writeAudit(
      {
        actor,
        action: "grant.created",
        entityType: "RoleGrant",
        entityId: grant.id,
        after: { email, role, departments, appliedNow: !!existingUser },
      },
      tx,
    );
    return { ok: true };
  }).catch((e: unknown) => (e instanceof Error && e.message === "last_admin" ? fail("You cannot remove the last admin.") : Promise.reject(e)));

  if (result.ok) revalidatePath("/admin/users");
  return result;
}

export async function deleteGrant(grantId: string): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  if (typeof grantId !== "string" || !grantId || grantId.length > 64) return fail("Invalid grant.");
  const grant = await db.roleGrant.findUnique({ where: { id: grantId } });
  if (!grant) return fail("Grant not found.");
  await db.$transaction(async (tx) => {
    await tx.roleGrant.delete({ where: { id: grantId } });
    await writeAudit(
      {
        actor,
        action: "grant.deleted",
        entityType: "RoleGrant",
        entityId: grantId,
        before: { email: grant.email, role: grant.role, departments: grant.departments },
      },
      tx,
    );
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
