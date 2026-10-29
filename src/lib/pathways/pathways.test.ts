import { describe, expect, it } from "vitest";
import type { EvalResult, Eligibility, GradeFit } from "@/lib/eligibility";
import { bestFit, nodeKind } from "./index";

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

describe("nodeKind", () => {
  const none = { hasPlan: true, fits: [] as GradeFit[] };
  it("plan entries win", () => {
    expect(nodeKind({ ...none, entry: "COMPLETED" })).toBe("completed");
    expect(nodeKind({ ...none, entry: "PLANNED" })).toBe("planned");
    expect(nodeKind({ ...none, entry: "IN_PROGRESS" })).toBe("planned");
  });
  it("shows no state without a plan", () => {
    expect(nodeKind({ entry: null, hasPlan: false, fits: [fit(10, "ELIGIBLE")] })).toBe("none");
  });
  it("maps fit to open, appeal and locked", () => {
    const k = (s: Eligibility) => nodeKind({ entry: null, hasPlan: true, fits: [fit(10, s)] });
    expect(k("ELIGIBLE")).toBe("open");
    expect(k("ELIGIBLE_WITH_WARNING")).toBe("open");
    expect(k("NOT_ELIGIBLE_APPEALABLE")).toBe("appeal");
    expect(k("NOT_ELIGIBLE_LOCKED")).toBe("locked");
  });
  it("uses the best grade", () => {
    expect(nodeKind({ entry: null, hasPlan: true, fits: [fit(9, "NOT_ELIGIBLE_LOCKED"), fit(10, "NOT_ELIGIBLE_APPEALABLE")] })).toBe("appeal");
  });
});
