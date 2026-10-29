/** Plan warnings. They inform, they never block. Pure, shared by client and server. */
import { sumCredits } from "@/lib/credits";
import { DEFAULT_SETTINGS, type GraduationSettings } from "@/lib/requirements";

export interface WarnEntry {
  id: string;
  name: string;
  gradeLevel: number;
  credits: number;
  gradesOffered: number[];
}

export type PlanWarning =
  | { code: "YEAR_UNDER_MIN"; grade: number; have: number; need: number }
  | { code: "TOO_MANY_PERIODS"; grade: number; periods: number; max: number }
  | { code: "GRADE_NOT_OFFERED"; entryId: string; name: string; grade: number; offered: number[] }
  // Produced by the eligibility engine in Phase 4.
  | { code: "UNMET_PREREQ"; entryId: string; name: string; detail: string }
  | { code: "MISSING_COREQ"; entryId: string; name: string; detail: string };

/** A full-year course is one period, a half-year course is half, a 10 credit double period is two. */
const periodsFor = (credits: number) => credits / 5;

export function computeWarnings(
  entries: WarnEntry[],
  settings: GraduationSettings = DEFAULT_SETTINGS,
  extra: PlanWarning[] = [],
): PlanWarning[] {
  const out: PlanWarning[] = [];

  for (const grade of [9, 10, 11, 12]) {
    const inYear = entries.filter((e) => e.gradeLevel === grade);
    const have = sumCredits(inYear.map((e) => e.credits));
    const need = grade === 12 ? settings.minFinalYear : settings.minPerYear;
    if (have < need) out.push({ code: "YEAR_UNDER_MIN", grade, have, need });

    const periods = inYear.reduce((n, e) => n + periodsFor(e.credits), 0);
    if (periods > settings.maxPeriodsPerYear) {
      out.push({ code: "TOO_MANY_PERIODS", grade, periods, max: settings.maxPeriodsPerYear });
    }
  }

  for (const e of entries) {
    if (e.gradesOffered.length > 0 && !e.gradesOffered.includes(e.gradeLevel)) {
      out.push({ code: "GRADE_NOT_OFFERED", entryId: e.id, name: e.name, grade: e.gradeLevel, offered: e.gradesOffered });
    }
  }

  return [...out, ...extra];
}

export function describeWarning(w: PlanWarning): string {
  switch (w.code) {
    case "YEAR_UNDER_MIN":
      return `Grade ${w.grade} has ${w.have} credits. The minimum is ${w.need}.`;
    case "TOO_MANY_PERIODS":
      return `Grade ${w.grade} has ${w.periods} periods of courses. Most schedules fit ${w.max}.`;
    case "GRADE_NOT_OFFERED":
      return `${w.name} is offered in grade ${w.offered.join(", ")}, not grade ${w.grade}.`;
    case "UNMET_PREREQ":
      return `${w.name}: ${w.detail}`;
    case "MISSING_COREQ":
      return `${w.name} must be taken together with another course. ${w.detail}`;
  }
}
