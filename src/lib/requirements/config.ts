import { db } from "@/lib/db";
import { DEFAULT_SETTINGS, type GraduationSettings, type RequirementKind, type RequirementRuleInput } from "./index";

export const GRADUATION_SETTING_KEY = "graduation";

/** Parses stored settings, falling back to the defaults for anything missing or malformed. */
export function parseSettings(value: unknown): GraduationSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const num = (k: keyof GraduationSettings) => {
    const n = v[k];
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : DEFAULT_SETTINGS[k];
  };
  return {
    totalRequired: num("totalRequired"),
    minPerYear: num("minPerYear"),
    minFinalYear: num("minFinalYear"),
    maxPeriodsPerYear: num("maxPeriodsPerYear"),
  };
}

export async function getGraduationConfig(): Promise<{ rules: RequirementRuleInput[]; settings: GraduationSettings }> {
  const [rules, setting] = await Promise.all([
    db.requirementRule.findMany({ orderBy: { label: "asc" } }),
    db.appSetting.findUnique({ where: { key: GRADUATION_SETTING_KEY } }),
  ]);
  return {
    rules: rules.map((r) => ({ kind: r.kind as RequirementKind, label: r.label, requiredCredits: Number(r.requiredCredits) })),
    settings: parseSettings(setting?.value),
  };
}
