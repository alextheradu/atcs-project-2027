import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/requirements";
import { computeWarnings, describeWarning, type WarnEntry } from "./index";

let n = 0;
const e = (over: Partial<WarnEntry> = {}): WarnEntry => ({
  id: `e${++n}`,
  name: "Course",
  gradeLevel: 9,
  credits: 5,
  gradesOffered: [9, 10, 11, 12],
  ...over,
});
const full = (grade: number, count: number, over: Partial<WarnEntry> = {}) =>
  Array.from({ length: count }, () => e({ gradeLevel: grade, ...over }));
const codes = (w: ReturnType<typeof computeWarnings>) => w.map((x) => x.code);

describe("year credit minimums", () => {
  it("warns under 30 credits in grades 9 to 11", () => {
    const w = computeWarnings([...full(9, 5)]);
    expect(w.find((x) => x.code === "YEAR_UNDER_MIN" && x.grade === 9)).toMatchObject({ have: 25, need: 30 });
  });
  it("is quiet at exactly 30", () => {
    const w = computeWarnings([...full(9, 6), ...full(10, 6), ...full(11, 6), ...full(12, 5)]);
    expect(codes(w)).not.toContain("YEAR_UNDER_MIN");
  });
  it("senior year needs only 25", () => {
    const ok = computeWarnings([...full(9, 6), ...full(10, 6), ...full(11, 6), ...full(12, 5)]);
    expect(ok.some((x) => x.code === "YEAR_UNDER_MIN" && x.grade === 12)).toBe(false);
    const bad = computeWarnings([...full(9, 6), ...full(10, 6), ...full(11, 6), ...full(12, 4)]);
    expect(bad.find((x) => x.code === "YEAR_UNDER_MIN" && x.grade === 12)).toMatchObject({ have: 20, need: 25 });
  });
  it("counts half-year courses exactly", () => {
    const entries = [...full(9, 5), e({ gradeLevel: 9, credits: 2.5 }), e({ gradeLevel: 9, credits: 2.5 })];
    expect(computeWarnings(entries).some((x) => x.code === "YEAR_UNDER_MIN" && x.grade === 9)).toBe(false);
  });
  it("uses the configured thresholds", () => {
    const w = computeWarnings(full(9, 5), { ...DEFAULT_SETTINGS, minPerYear: 25 });
    expect(w.some((x) => x.code === "YEAR_UNDER_MIN" && x.grade === 9)).toBe(false);
  });
});

describe("too many courses", () => {
  it("warns above 8 periods", () => {
    const w = computeWarnings(full(10, 9));
    expect(w.find((x) => x.code === "TOO_MANY_PERIODS")).toMatchObject({ grade: 10, periods: 9, max: 8 });
  });
  it("allows exactly 8", () => {
    expect(codes(computeWarnings(full(10, 8)))).not.toContain("TOO_MANY_PERIODS");
  });
  it("a two-period 10 credit course counts twice, half-years count half", () => {
    const entries = [...full(11, 7), e({ gradeLevel: 11, credits: 10 })];
    expect(computeWarnings(entries).find((x) => x.code === "TOO_MANY_PERIODS")).toMatchObject({ periods: 9 });
    const halves = [...full(11, 7), e({ gradeLevel: 11, credits: 2.5 }), e({ gradeLevel: 11, credits: 2.5 })];
    expect(codes(computeWarnings(halves))).not.toContain("TOO_MANY_PERIODS");
  });
  it("is configurable", () => {
    expect(codes(computeWarnings(full(10, 7), { ...DEFAULT_SETTINGS, maxPeriodsPerYear: 6 }))).toContain("TOO_MANY_PERIODS");
  });
});

describe("grade not offered", () => {
  it("warns when a course is placed in a grade it is not offered in", () => {
    const w = computeWarnings([e({ id: "x", name: "AP Calculus BC", gradeLevel: 9, gradesOffered: [11, 12] })]);
    expect(w.find((x) => x.code === "GRADE_NOT_OFFERED")).toMatchObject({ entryId: "x", grade: 9, offered: [11, 12] });
  });
  it("is quiet when offered, or when the catalog gives no grades", () => {
    expect(codes(computeWarnings([e({ gradesOffered: [9] })]))).not.toContain("GRADE_NOT_OFFERED");
    expect(codes(computeWarnings([e({ gradesOffered: [] })]))).not.toContain("GRADE_NOT_OFFERED");
  });
});

describe("hooks and messages", () => {
  it("passes through extra warnings from the eligibility engine", () => {
    const extra = [{ code: "UNMET_PREREQ" as const, entryId: "x", name: "AP Calculus BC", detail: "Needs AP Pre-Calculus" }];
    expect(codes(computeWarnings([], DEFAULT_SETTINGS, extra))).toContain("UNMET_PREREQ");
  });
  it("describes every warning in plain words without em dashes", () => {
    const all = [
      ...computeWarnings([...full(9, 5), ...full(10, 9), e({ id: "z", name: "AP Physics C", gradeLevel: 9, gradesOffered: [12] })]),
      { code: "UNMET_PREREQ" as const, entryId: "x", name: "AP Calculus BC", detail: "Needs AP Pre-Calculus." },
      { code: "MISSING_COREQ" as const, entryId: "x", name: "AP Microeconomics", detail: "Also take AP Macroeconomics." },
    ];
    for (const w of all) {
      const text = describeWarning(w);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain("—");
    }
  });
});
