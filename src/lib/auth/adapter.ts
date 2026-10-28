import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { normalizeEmail } from "./policy";
import { evaluateForEmail, findUserByAnyEmail } from "./service";

/**
 * Prisma adapter with two changes:
 * - getUserByEmail also resolves linked emails, so a second address signs in as the same user.
 * - createUser sets the role from the signup policy, never from the email domain alone.
 */
export function createAdapter(): Adapter {
  const base = PrismaAdapter(db as never);

  return {
    ...base,
    async getUserByEmail(email) {
      return (await findUserByAnyEmail(email)) as never;
    },
    async createUser(data) {
      const email = normalizeEmail(data.email);
      const result = await evaluateForEmail(email, true);
      if (!result.allow) throw new Error(`signup_denied:${result.reason}`);

      const user = await db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            name: data.name ?? null,
            image: data.image ?? null,
            emailVerified: new Date(),
            role: result.role ?? "STUDENT",
            departments: result.departments,
          },
        });
        if (result.source === "grant") {
          await tx.roleGrant.updateMany({ where: { email, appliedAt: null }, data: { appliedAt: new Date() } });
        }
        await writeAudit(
          {
            actor: null,
            action: "user.created",
            entityType: "User",
            entityId: created.id,
            after: { role: created.role, source: result.source },
          },
          tx,
        );
        return created;
      });
      return user as never;
    },
  };
}
