/** Graduation requirement tracking. Pure, shared by client and server. */
import { fromTenths, toTenths } from "@/lib/credits";

export type RequirementKind =
  | "ENGLISH" | "MATH" | "SCI_BIO" | "SCI_CHEM" | "SCI_PHYS" | "SOCIAL_STUDIES"
  | "ARTS" | "LIFE_CAREERS" | "FIN_LIT" | "WORLD_LANG" | "PE_HEALTH";
export type EntryStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export interface CourseTag {
  kind: RequirementKind;
  credits: number;
  provisional: boolean;
}

export interface TrackedEntry {
  id: string;
  gradeLevel: number;
  status: EntryStatus;
  /** Credits actually counted for this entry (can differ from the catalog, e.g. 6 for an honors science). */
  credits: number;
  /** Catalog credits for the course. */
  courseCredits: number;
  tags: CourseTag[];
}

export interface RequirementRuleInput {
  kind: RequirementKind;
  label: string;
  requiredCredits: number;
}

export interface GraduationSettings {
  totalRequired: number;
  minPerYear: number;
  minFinalYear: number;
  maxPeriodsPerYear: number;
}

export const DEFAULT_SETTINGS: GraduationSettings = {
  totalRequired: 120,
  minPerYear: 30,
  minFinalYear: 25,
  maxPeriodsPerYear: 8,
};

export interface KindProgress {
  kind: RequirementKind;
  label: string;
  required: number;
  earned: number;
  scheduled: number;
  total: number;
  missing: number;
  /** Credits counted through tags a counselor has not confirmed yet. */
  provisional: number;
  met: boolean;
}

export interface YearProgress {
  grade: number;
  earned: number;
  scheduled: number;
  total: number;
}

export interface GraduationSummary {
  kinds: KindProgress[];
  totalRequired: number;
  earned: number;
  scheduled: number;
  total: number;
  missing: number;
  years: YearProgress[];
  missingList: { kind: RequirementKind; label: string; missing: number }[];
  complete: boolean;
}

/**
 * How many credits an entry gives toward one requirement. A tag worth less than the whole course
 * (American Studies is 5 + 5, Applied Physics is 5 of 10) counts its own credits. A full tag counts
 * what the student actually has, so a 6 credit honors science counts 6.
 */
export function tagContribution(entry: TrackedEntry, tag: CourseTag): number {
  return tag.credits < entry.courseCredits ? tag.credits : entry.credits;
}

export function summarize(
  entries: TrackedEntry[],
  rules: RequirementRuleInput[],
  settings: GraduationSettings = DEFAULT_SETTINGS,
): GraduationSummary {
  const earnedStatus = (e: TrackedEntry) => e.status === "COMPLETED";

  const kinds: KindProgress[] = rules.map((rule) => {
    let earned = 0;
    let scheduled = 0;
    let provisional = 0;
    for (const e of entries) {
      for (const t of e.tags) {
        if (t.kind !== rule.kind) continue;
        const c = toTenths(tagContribution(e, t));
        if (earnedStatus(e)) earned += c;
        else scheduled += c;
        if (t.provisional) provisional += c;
      }
    }
    const required = toTenths(rule.requiredCredits);
    const total = earned + scheduled;
    const missing = Math.max(0, required - total);
    return {
      kind: rule.kind,
      label: rule.label,
      required: fromTenths(required),
      earned: fromTenths(earned),
      scheduled: fromTenths(scheduled),
      total: fromTenths(total),
      missing: fromTenths(missing),
      provisional: fromTenths(provisional),
      met: missing === 0,
    };
  });

  const years: YearProgress[] = [9, 10, 11, 12].map((grade) => {
    let earned = 0;
    let scheduled = 0;
    for (const e of entries) {
      if (e.gradeLevel !== grade) continue;
      if (earnedStatus(e)) earned += toTenths(e.credits);
      else scheduled += toTenths(e.credits);
    }
    return { grade, earned: fromTenths(earned), scheduled: fromTenths(scheduled), total: fromTenths(earned + scheduled) };
  });

  const earned = years.reduce((n, y) => n + toTenths(y.earned), 0);
  const scheduled = years.reduce((n, y) => n + toTenths(y.scheduled), 0);
  const total = earned + scheduled;
  const totalRequired = toTenths(settings.totalRequired);
  const missing = Math.max(0, totalRequired - total);

  const missingList = kinds
    .filter((k) => !k.met)
    .map((k) => ({ kind: k.kind, label: k.label, missing: k.missing }))
    .sort((a, b) => b.missing - a.missing);

  return {
    kinds,
    totalRequired: fromTenths(totalRequired),
    earned: fromTenths(earned),
    scheduled: fromTenths(scheduled),
    total: fromTenths(total),
    missing: fromTenths(missing),
    years,
    missingList,
    complete: kinds.every((k) => k.met) && missing === 0,
  };
}
