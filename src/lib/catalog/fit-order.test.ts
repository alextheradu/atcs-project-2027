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

  it("handles an empty list", () => {
    expect(sortByFit([], () => undefined)).toEqual([]);
  });
});
