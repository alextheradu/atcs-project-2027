import { describe, expect, it } from "vitest";
import type { Eligibility } from "../eligibility/types";
import { fitRank, sortByFit } from "./fit-order";

const fit = (status: Eligibility, viaAppeal = false) => ({ status, viaAppeal });

describe("fitRank", () => {
  it("orders can take, check first, placement review, then missing a prerequisite", () => {
    expect(fitRank(fit("ELIGIBLE"))).toBe(0);
    expect(fitRank(fit("ELIGIBLE_WITH_WARNING"))).toBe(1);
    expect(fitRank(fit("NOT_ELIGIBLE_APPEALABLE"))).toBe(2);
    expect(fitRank(fit("NOT_ELIGIBLE_LOCKED"))).toBe(3);
  });

  it("counts an approved appeal as a class the student can take", () => {
    expect(fitRank(fit("ELIGIBLE", true))).toBe(0);
  });

  it("puts a class with no result after every known one", () => {
    expect(fitRank(undefined)).toBe(4);
  });
});

describe("sortByFit", () => {
  const fits: Record<string, ReturnType<typeof fit>> = {
    a: fit("NOT_ELIGIBLE_LOCKED"),
    b: fit("ELIGIBLE"),
    c: fit("ELIGIBLE_WITH_WARNING"),
    d: fit("NOT_ELIGIBLE_APPEALABLE"),
    e: fit("ELIGIBLE", true),
    f: fit("ELIGIBLE"),
  };

  it("sorts by tier and keeps the incoming order inside a tier", () => {
    const rows = ["a", "b", "c", "d", "e", "f"];
    expect(sortByFit(rows, (r) => fits[r])).toEqual(["b", "e", "f", "c", "d", "a"]);
  });

  it("does not change the input array", () => {
    const rows = ["a", "b"];
    sortByFit(rows, (r) => fits[r]);
    expect(rows).toEqual(["a", "b"]);
  });

  it("can order each tier by level, College prep first, so Honors is not presented as the default", () => {
    const level: Record<string, string> = { b: "HONORS", e: "AP", f: "CP" };
    expect(sortByFit(["b", "e", "f"], (r) => fits[r], (r) => level[r])).toEqual(["f", "b", "e"]);
  });

  it("ranks a class that only needs its partner class with the warnings, not with placement reviews", () => {
    const partner = { status: "NOT_ELIGIBLE_APPEALABLE" as const, viaAppeal: false, unmet: [{ rule: { type: "coreq" as const, courses: ["x"] } }] };
    const review = { status: "NOT_ELIGIBLE_APPEALABLE" as const, viaAppeal: false, unmet: [{ rule: { type: "minGrade" as const, courses: ["x"] } }] };
    const all: Record<string, unknown> = { p: partner, r: review, w: fit("ELIGIBLE_WITH_WARNING") };
    expect(sortByFit(["r", "p", "w"], (k) => all[k] as never)).toEqual(["p", "w", "r"]);
  });

  it("handles an empty list", () => {
    expect(sortByFit([], () => undefined)).toEqual([]);
  });
});
