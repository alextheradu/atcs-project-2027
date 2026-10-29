import { describe, expect, it } from "vitest";
import { filterCourses, type PickerCourse } from "./filter";

const c = (over: Partial<PickerCourse>): PickerCourse => ({
  id: over.name ?? "x",
  slug: "s",
  name: "Course",
  department: "MATH",
  level: "CP",
  duration: "FULL",
  credits: 5,
  gradesOffered: [9, 10, 11, 12],
  interests: [],
  ...over,
});
const list = [
  c({ name: "Algebra I", department: "MATH", gradesOffered: [10] }),
  c({ name: "AP Calculus BC", department: "MATH", level: "AP", gradesOffered: [11, 12], interests: ["engineering-building"] }),
  c({ name: "Financial Literacy", department: "BUSINESS", duration: "HALF", credits: 2.5 }),
  c({ name: "Biology", department: "SCIENCE", gradesOffered: [9], interests: ["medicine-health"] }),
];
const names = (r: PickerCourse[]) => r.map((x) => x.name);

describe("filterCourses", () => {
  it("returns everything sorted by name with no filter", () => {
    expect(names(filterCourses(list, {}))).toEqual(["Algebra I", "AP Calculus BC", "Biology", "Financial Literacy"]);
  });
  it("searches names case-insensitively, prefix matches first", () => {
    expect(names(filterCourses(list, { q: "al" }))).toEqual(["Algebra I", "AP Calculus BC", "Financial Literacy"]);
    expect(names(filterCourses(list, { q: "FIN" }))).toEqual(["Financial Literacy"]);
  });
  it("combines filters", () => {
    expect(names(filterCourses(list, { department: "MATH", grade: 11 }))).toEqual(["AP Calculus BC"]);
    expect(names(filterCourses(list, { level: "AP" }))).toEqual(["AP Calculus BC"]);
    expect(names(filterCourses(list, { duration: "HALF" }))).toEqual(["Financial Literacy"]);
    expect(names(filterCourses(list, { credits: 2.5 }))).toEqual(["Financial Literacy"]);
    expect(names(filterCourses(list, { interest: "medicine-health" }))).toEqual(["Biology"]);
  });
  it("can hide courses already in the plan", () => {
    expect(names(filterCourses(list, { exclude: new Set(["Biology"]) }))).not.toContain("Biology");
  });
  it("returns nothing for a query with no match", () => {
    expect(filterCourses(list, { q: "zzzz" })).toEqual([]);
  });
});
