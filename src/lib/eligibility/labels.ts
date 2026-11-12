import type { Eligibility, EvalResult } from "./types";

export type EligibilityTone = "eligible" | "warning" | "appeal" | "locked";

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  ELIGIBLE: "Can take",
  ELIGIBLE_WITH_WARNING: "Check first",
  NOT_ELIGIBLE_APPEALABLE: "Needs placement review",
  NOT_ELIGIBLE_LOCKED: "Missing a prerequisite",
};

export const ELIGIBILITY_TONE: Record<Eligibility, EligibilityTone> = {
  ELIGIBLE: "eligible",
  ELIGIBLE_WITH_WARNING: "warning",
  NOT_ELIGIBLE_APPEALABLE: "appeal",
  NOT_ELIGIBLE_LOCKED: "locked",
};

export const eligibilityLabel = (r: Pick<EvalResult, "status" | "viaAppeal">): string =>
  r.viaAppeal ? "Approved by review" : ELIGIBILITY_LABEL[r.status];
