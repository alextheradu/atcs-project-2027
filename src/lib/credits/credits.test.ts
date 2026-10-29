import { describe, expect, it } from "vitest";
import { addCredits, formatCredits, fromTenths, sumCredits, toTenths } from "./index";

describe("credit math (integer tenths)", () => {
  it("converts to and from tenths", () => {
    expect(toTenths(2.5)).toBe(25);
    expect(toTenths("5.0")).toBe(50);
    expect(fromTenths(25)).toBe(2.5);
  });
  it("handles Prisma Decimal-like values", () => {
    expect(toTenths({ toString: () => "2.5" })).toBe(25);
  });
  it("two half-year courses equal one full-year slot", () => {
    expect(addCredits(2.5, 2.5)).toBe(5);
  });
  it("never drifts the way floats do", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumCredits([0.1, 0.2])).toBe(0.3);
    expect(sumCredits(Array.from({ length: 48 }, () => 2.5))).toBe(120);
  });
  it("sums an empty list to zero", () => {
    expect(sumCredits([])).toBe(0);
  });
  it("rejects non finite values", () => {
    expect(() => toTenths("abc")).toThrow();
    expect(() => toTenths(Number.NaN)).toThrow();
  });
  it("formats without trailing zeros", () => {
    expect(formatCredits(5)).toBe("5");
    expect(formatCredits(2.5)).toBe("2.5");
    expect(formatCredits(120)).toBe("120");
  });
});
