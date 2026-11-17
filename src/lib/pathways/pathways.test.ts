import { describe, expect, it } from "vitest";
import type { EvalResult, Eligibility, GradeFit } from "@/lib/eligibility";
import { bestFit, gradeColumn, studentGrade } from "./index";

const fit = (grade: number, status: Eligibility): GradeFit => ({
  grade,
  result: { status, tree: null, leaves: [], unmet: [], viaAppeal: false, summary: "", notes: [], missing: [] } satisfies EvalResult,
});

describe("bestFit", () => {
  it("picks the grade with the friendliest result, earliest on a tie", () => {
    expect(bestFit([fit(11, "NOT_ELIGIBLE_LOCKED"), fit(12, "NOT_ELIGIBLE_APPEALABLE")])?.grade).toBe(12);
    expect(bestFit([fit(11, "ELIGIBLE"), fit(12, "ELIGIBLE")])?.grade).toBe(11);
    expect(bestFit([])).toBeNull();
  });
});

describe("studentGrade", () => {
  it("uses the profile grade when it is known", () => {
    expect(studentGrade(11, [{ status: "COMPLETED", gradeLevel: 9 }])).toBe(11);
    expect(studentGrade(8, [])).toBe(8);
  });
  it("otherwise takes the year after the last completed class", () => {
    expect(studentGrade(null, [
      { status: "COMPLETED", gradeLevel: 9 },
      { status: "COMPLETED", gradeLevel: 10 },
      { status: "PLANNED", gradeLevel: 12 },
      { status: "IN_PROGRESS", gradeLevel: 11 },
    ])).toBe(11);
  });
  it("never goes past 12th", () => {
    expect(studentGrade(null, [{ status: "COMPLETED", gradeLevel: 12 }])).toBe(12);
  });
  it("is unknown with no profile grade and nothing completed", () => {
    expect(studentGrade(null, [])).toBeNull();
    expect(studentGrade(undefined, [{ status: "PLANNED", gradeLevel: 10 }])).toBeNull();
  });
});

describe("gradeColumn", () => {
  const years = ["8th grade", "9th grade", "10th grade", "11th grade", "12th grade"];
  it("finds the column for a grade", () => {
    expect(gradeColumn(years, 11)).toBe(3);
    expect(gradeColumn(years, 8)).toBe(0);
    expect(gradeColumn(["9th grade", "10th grade", "11th grade"], 9)).toBe(0);
  });
  it("matches a column that starts at that grade", () => {
    expect(gradeColumn(["Any grade", "10th to 12th grade", "11th or 12th grade", "12th grade"], 11)).toBe(2);
    expect(gradeColumn(["Any grade", "10th to 12th grade", "11th or 12th grade", "12th grade"], 12)).toBe(3);
  });
  it("is null when no column is a grade", () => {
    expect(gradeColumn(["Level I", "Level II", "Level III"], 10)).toBeNull();
    expect(gradeColumn(["9th grade", "10th grade", "11th grade"], 12)).toBeNull();
    expect(gradeColumn(years, null)).toBeNull();
  });
});
