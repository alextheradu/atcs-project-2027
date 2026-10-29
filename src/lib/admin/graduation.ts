"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { REQUIREMENT_KINDS } from "@/lib/catalog/schemas";
import { GRADUATION_SETTING_KEY, getGraduationConfig } from "@/lib/requirements/config";
import { z } from "zod";
import type { ActionResult } from "./users";

const credits = z.number().min(0).max(200).multipleOf(0.5);

const schema = z.object({
  rules: z
    .array(z.object({ kind: z.enum(REQUIREMENT_KINDS), requiredCredits: credits }))
    .length(REQUIREMENT_KINDS.length),
  settings: z.object({
    totalRequired: credits.min(1),
    minPerYear: credits,
    minFinalYear: credits,
    maxPeriodsPerYear: z.number().int().min(1).max(12),
  }),
});

/** Graduation thresholds. Admin only. The rules and the four numbers change together, audited with before and after. */
export async function updateGraduationConfig(input: unknown): Promise<ActionResult> {
  const actor = await requireRole("ADMIN");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Credits must be in steps of 0.5, and every requirement needs a value." };
  const kinds = new Set(parsed.data.rules.map((r) => r.kind));
  if (kinds.size !== REQUIREMENT_KINDS.length) return { ok: false, error: "Each requirement can appear once." };

  const before = await getGraduationConfig();
  await db.$transaction(async (tx) => {
    for (const r of parsed.data.rules) {
      await tx.requirementRule.update({ where: { kind: r.kind }, data: { requiredCredits: r.requiredCredits } });
    }
    await tx.appSetting.upsert({
      where: { key: GRADUATION_SETTING_KEY },
      create: { key: GRADUATION_SETTING_KEY, value: parsed.data.settings, updatedById: actor.id },
      update: { value: parsed.data.settings, updatedById: actor.id },
    });
    await writeAudit(
      {
        actor,
        action: "settings.graduation",
        entityType: "AppSetting",
        entityId: GRADUATION_SETTING_KEY,
        before: { rules: before.rules.map((r) => ({ kind: r.kind, requiredCredits: r.requiredCredits })), settings: { ...before.settings } },
        after: { rules: parsed.data.rules, settings: { ...parsed.data.settings } },
      },
      tx,
    );
  });
  revalidatePath("/admin/settings");
  revalidatePath("/plans", "layout");
  return { ok: true };
}
