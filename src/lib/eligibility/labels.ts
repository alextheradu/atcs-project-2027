import type { Eligibility, EvalResult } from "./types";

export type EligibilityTone = "eligible" | "warning" | "appeal" | "locked";

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  ELIGIBLE: "Eligible",
  ELIGIBLE_WITH_WARNING: "Check details",
  NOT_ELIGIBLE_APPEALABLE: "Needs appeal",
  NOT_ELIGIBLE_LOCKED: "Locked",
};

export const ELIGIBILITY_TONE: Record<Eligibility, EligibilityTone> = {
  ELIGIBLE: "eligible",
  ELIGIBLE_WITH_WARNING: "warning",
  NOT_ELIGIBLE_APPEALABLE: "appeal",
  NOT_ELIGIBLE_LOCKED: "locked",
};

export const eligibilityLabel = (r: Pick<EvalResult, "status" | "viaAppeal">): string =>
  r.viaAppeal ? "Approved via appeal" : ELIGIBILITY_LABEL[r.status];
