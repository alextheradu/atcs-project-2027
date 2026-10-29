import { describe, expect, it } from "vitest";
import { courseDemand, offTrackReasons, sortDemand, type DemandRow } from "./index";

const r = (studentId: string, courseId: string, planStatus: string, isPrimary: boolean, gradeLevel = 10): DemandRow => ({ studentId, courseId, planStatus, isPrimary, gradeLevel });

describe("courseDemand", () => {
  it("counts primary plans and submitted or approved plans, not other drafts", () => {
    const d = courseDemand([
      r("s1", "calc", "DRAFT", true),
      r("s2", "calc", "DRAFT", false), // a what-if draft
      r("s3", "calc", "SUBMITTED", false),
      r("s4", "calc", "APPROVED", false),
      r("s5", "calc", "CHANGES_REQUESTED", false), // not primary, not submitted
    ]);
    expect(d).toEqual([{ courseId: "calc", students: 3, byGrade: { 10: 3 } }]);
  });
  it("counts a student once per course even across plans", () => {
    const d = courseDemand([r("s1", "calc", "DRAFT", true, 11), r("s1", "calc", "SUBMITTED", false, 12)]);
    expect(d[0].students).toBe(1);
    expect(d[0].byGrade).toEqual({ 11: 1 });
  });
  it("breaks the count down by grade", () => {
    const d = courseDemand([r("s1", "bio", "DRAFT", true, 9), r("s2", "bio", "DRAFT", true, 9), r("s3", "bio", "DRAFT", true, 10)]);
    expect(d[0].byGrade).toEqual({ 9: 2, 10: 1 });
  });
  it("returns nothing when no plan counts", () => {
    expect(courseDemand([r("s1", "calc", "DRAFT", false)])).toEqual([]);
  });
});

describe("sortDemand", () => {
  const rows = [
    { courseId: "a", name: "Art", students: 2, byGrade: {} },
    { courseId: "b", name: "Biology", students: 9, byGrade: {} },
    { courseId: "c", name: "Calculus", students: 9, byGrade: {} },
  ];
  it("sorts by demand, ties by name, or by name", () => {
    expect(sortDemand(rows, "students").map((x) => x.name)).toEqual(["Biology", "Calculus", "Art"]);
    expect(sortDemand(rows, "name").map((x) => x.name)).toEqual(["Art", "Biology", "Calculus"]);
  });
  it("does not change the input", () => {
    const copy = [...rows];
    sortDemand(rows, "students");
    expect(rows).toEqual(copy);
  });
});

describe("offTrackReasons", () => {
  it("lists open requirements and a low year", () => {
    expect(offTrackReasons({ complete: false, missing: 5, missingList: [{ label: "English", missing: 5 }], warnings: [{ code: "YEAR_UNDER_MIN" }] })).toEqual([
      "English: 5 credits short",
      "A year is under the credit minimum",
    ]);
  });
  it("is empty for a plan that covers everything", () => {
    expect(offTrackReasons({ complete: true, missing: 0, missingList: [], warnings: [] })).toEqual([]);
  });
});
