"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { GUIDANCE_KEY, guidanceSchema, parseGuidance } from "./index";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Admins edit the college guidance numbers shown on every plan. */
export async function saveGuidance(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const p = guidanceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the numbers. Years run from 0 to 4." };
  const before = await db.appSetting.findUnique({ where: { key: GUIDANCE_KEY } });
  await db.$transaction(async (tx) => {
    await tx.appSetting.upsert({
      where: { key: GUIDANCE_KEY },
      create: { key: GUIDANCE_KEY, value: p.data as unknown as Prisma.InputJsonValue, updatedById: actor.id },
      update: { value: p.data as unknown as Prisma.InputJsonValue, updatedById: actor.id },
    });
    await writeAudit({ actor, action: "settings.guidance", entityType: "AppSetting", entityId: GUIDANCE_KEY, before: before ? (parseGuidance(before.value) as unknown as Prisma.InputJsonValue) : null, after: p.data as unknown as Prisma.InputJsonValue }, tx);
  });
  revalidatePath("/plans");
  revalidatePath("/admin/major-guidance");
  return { ok: true };
}
