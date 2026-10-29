import { describe, expect, it } from "vitest";
import { placementForGrade, snapshotExpiry } from "./placement";
import { HONESTY_TEXT, currentBackgroundSchema, incomingBackgroundSchema } from "./schemas";

describe("placementForGrade", () => {
  const oct2026 = new Date("2026-10-29T12:00:00Z");
  it("maps each grade to a cohort, a student role and a graduation year", () => {
    expect(placementForGrade(9, oct2026)).toEqual({ cohort: "CURRENT", role: "STUDENT", gradYear: 2030, currentGrade: 9 });
    expect(placementForGrade(12, oct2026).gradYear).toBe(2027);
    expect(placementForGrade(8, oct2026)).toEqual({ cohort: "INCOMING_8", role: "INCOMING", gradYear: 2031, currentGrade: 8 });
  });
  it("uses the school year that started last July in spring", () => {
    expect(placementForGrade(12, new Date("2027-03-01T00:00:00Z")).gradYear).toBe(2027);
    expect(placementForGrade(12, new Date("2027-07-02T00:00:00Z")).gradYear).toBe(2028);
  });
  it("can only ever produce a student role, for every grade", () => {
    for (const g of [8, 9, 10, 11, 12] as const) expect(["STUDENT", "INCOMING"]).toContain(placementForGrade(g).role);
  });
});

describe("snapshotExpiry", () => {
  const now = new Date("2026-10-29T00:00:00Z");
  it("uses the earliest appeal window that has not closed", () => {
    const d = snapshotExpiry([{ closesAt: new Date("2026-09-01T00:00:00Z") }, { closesAt: new Date("2027-05-01T00:00:00Z") }, { closesAt: new Date("2027-03-01T00:00:00Z") }, { closesAt: null }], now);
    expect(d.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });
  it("falls back to the end of August", () => {
    expect(snapshotExpiry([], now).toISOString()).toBe("2027-08-31T23:59:59.000Z");
    expect(snapshotExpiry([], new Date("2027-03-01T00:00:00Z")).toISOString()).toBe("2027-08-31T23:59:59.000Z");
  });
});

describe("background schemas", () => {
  const ok = { interests: ["coding-cs"], eighthMath: "ALGEBRA_I", eighthMathGrade: "A", honest: true };
  it("requires the honesty box for 8th graders", () => {
    expect(incomingBackgroundSchema.safeParse(ok).success).toBe(true);
    expect(incomingBackgroundSchema.safeParse({ ...ok, honest: false }).success).toBe(false);
    const { honest, ...rest } = ok;
    void honest;
    expect(incomingBackgroundSchema.safeParse(rest).success).toBe(false);
  });
  it("treats unknown and undisclosed grades as nothing", () => {
    expect(incomingBackgroundSchema.parse({ ...ok, scienceGrade: "" }).scienceGrade).toBeNull();
    expect(incomingBackgroundSchema.parse({ ...ok, scienceGrade: null }).scienceGrade).toBeNull();
  });
  it("rejects grades the dropdown does not offer and bad interests", () => {
    expect(incomingBackgroundSchema.safeParse({ ...ok, englishGrade: "F" }).success).toBe(false);
    expect(incomingBackgroundSchema.safeParse({ ...ok, interests: ["../x"] }).success).toBe(false);
    expect(currentBackgroundSchema.safeParse({ eighthMath: "CALCULUS" }).success).toBe(false);
  });
  it("keeps the honesty text verbatim", () => {
    expect(HONESTY_TEXT.startsWith("Be honest here. Nobody is grading you")).toBe(true);
    expect(HONESTY_TEXT.endsWith("from your actual records.")).toBe(true);
  });
});
