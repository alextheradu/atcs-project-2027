import type { Eligibility, EvalResult } from "./types";

export type EligibilityTone = "eligible" | "warning" | "appeal" | "locked";

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  ELIGIBLE: "Can take",
  ELIGIBLE_WITH_WARNING: "Read this first",
  NOT_ELIGIBLE_APPEALABLE: "Needs placement review",
  NOT_ELIGIBLE_LOCKED: "Missing a prerequisite",
};

export const ELIGIBILITY_TONE: Record<Eligibility, EligibilityTone> = {
  ELIGIBLE: "eligible",
  ELIGIBLE_WITH_WARNING: "warning",
  NOT_ELIGIBLE_APPEALABLE: "appeal",
  NOT_ELIGIBLE_LOCKED: "locked",
};

export const PARTNER_LABEL = "Needs its partner class";

/** What each color means, for the Board legend. Same words as the labels above. */
export const TONE_MEANING: Record<Exclude<EligibilityTone, "eligible">, string> = {
  warning: "Something to fix or read on your board",
  appeal: ELIGIBILITY_LABEL.NOT_ELIGIBLE_APPEALABLE,
  locked: ELIGIBILITY_LABEL.NOT_ELIGIBLE_LOCKED,
};

type Judged = Pick<EvalResult, "status" | "viaAppeal" | "unmet"> & { taken?: boolean };

/** Only a partner class stands in the way: fixed by adding a class, not by a placement review. */
export const isCoreqOnly = (r: Pick<EvalResult, "unmet">): boolean => r.unmet.length > 0 && r.unmet.every((l) => l.rule.type === "coreq");

/**
 * The one label and color for a result. Tiles, the class sheet, badges, the per-grade list and the class page all
 * use this, so a class never reads one way on the Board and another on its page.
 */
export function displayStatus(r: Judged): { tone: EligibilityTone; label: string } {
  if (r.taken) return { tone: "eligible", label: "Taken" };
  if (r.viaAppeal) return { tone: "eligible", label: "Approved by review" };
  if ((r.status === "NOT_ELIGIBLE_APPEALABLE" || r.status === "NOT_ELIGIBLE_LOCKED") && isCoreqOnly(r)) return { tone: "warning", label: PARTNER_LABEL };
  return { tone: ELIGIBILITY_TONE[r.status], label: ELIGIBILITY_LABEL[r.status] };
}

export const eligibilityLabel = (r: Judged): string => displayStatus(r).label;
