import { describe, expect, it } from "vitest";
import type { EvalResult, Eligibility, GradeFit } from "@/lib/eligibility";
import { bestFit } from "./index";

const fit = (grade: number, status: Eligibility): GradeFit => ({
  grade,
  result: { status, tree: null, leaves: [], unmet: [], viaAppeal: false, summary: "" } satisfies EvalResult,
});

describe("bestFit", () => {
  it("picks the grade with the friendliest result, earliest on a tie", () => {
    expect(bestFit([fit(11, "NOT_ELIGIBLE_LOCKED"), fit(12, "NOT_ELIGIBLE_APPEALABLE")])?.grade).toBe(12);
    expect(bestFit([fit(11, "ELIGIBLE"), fit(12, "ELIGIBLE")])?.grade).toBe(11);
    expect(bestFit([])).toBeNull();
  });
});
