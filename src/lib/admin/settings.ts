"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "./users";
import { addDomainSchema, signupModeSchema } from "./schemas";

const fail = (error: string): ActionResult => ({ ok: false, error });

export async function setSignupMode(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const parsed = signupModeSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid signup mode.");
  const before = await db.appSetting.findUnique({ where: { key: "signupMode" } });
  await db.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: "signupMode" },
      create: { key: "signupMode", value: parsed.data, updatedById: actor.id },
      update: { value: parsed.data, updatedById: actor.id },
    });
    await writeAudit(
      {
        actor,
        action: "settings.signup_mode",
        entityType: "AppSetting",
        entityId: "signupMode",
        before: { value: before?.value ?? null },
        after: { value: parsed.data },
      },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function addAllowedDomain(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const parsed = addDomainSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid domain.");
  const { domain, cohort, label } = parsed.data;
  if (await db.allowedDomain.findUnique({ where: { domain } })) return fail("That domain already exists.");
  await db.$transaction(async (tx) => {
    const row = await tx.allowedDomain.create({ data: { domain, cohort, label } });
    await writeAudit(
      { actor, action: "domain.added", entityType: "AllowedDomain", entityId: row.id, after: { domain, cohort } },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function setDomainEnabled(domainId: string, enabled: boolean): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  if (typeof domainId !== "string" || !domainId || domainId.length > 64 || typeof enabled !== "boolean") {
    return fail("Invalid input.");
  }
  const row = await db.allowedDomain.findUnique({ where: { id: domainId } });
  if (!row) return fail("Domain not found.");
  await db.$transaction(async (tx) => {
    await tx.allowedDomain.update({ where: { id: domainId }, data: { enabled } });
    await writeAudit(
      {
        actor,
        action: "domain.toggled",
        entityType: "AllowedDomain",
        entityId: domainId,
        before: { enabled: row.enabled },
        after: { enabled },
      },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeAllowedDomain(domainId: string): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  if (typeof domainId !== "string" || !domainId || domainId.length > 64) return fail("Invalid input.");
  const row = await db.allowedDomain.findUnique({ where: { id: domainId } });
  if (!row) return fail("Domain not found.");
  await db.$transaction(async (tx) => {
    await tx.allowedDomain.delete({ where: { id: domainId } });
    await writeAudit(
      {
        actor,
        action: "domain.removed",
        entityType: "AllowedDomain",
        entityId: domainId,
        before: { domain: row.domain, cohort: row.cohort },
      },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}
