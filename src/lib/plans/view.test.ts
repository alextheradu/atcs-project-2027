import { describe, expect, it } from "vitest";
import { GRADE_OPTIONS, gradeLabel, toTracked, toWarnEntry, type EntryView } from "./view";
import { LETTER_GRADES } from "./schemas";

const e: EntryView = {
  id: "e1", courseId: "c1", slug: "honors-biology", name: "Honors Biology", department: "SCIENCE", level: "HONORS",
  duration: "FULL", gradeLevel: 9, status: "COMPLETED", grade: "A_MINUS", credits: 6, courseCredits: 5,
  gradesOffered: [9], tags: [{ kind: "SCI_BIO", credits: 5, provisional: false }],
  rules: null, prereqText: null, approvedAppeal: false,
};

describe("entry view mappers", () => {
  it("maps to the requirement tracker input", () => {
    expect(toTracked(e)).toEqual({ id: "e1", gradeLevel: 9, status: "COMPLETED", credits: 6, courseCredits: 5, tags: e.tags });
  });
  it("maps to the warning input", () => {
    expect(toWarnEntry(e)).toEqual({ id: "e1", name: "Honors Biology", gradeLevel: 9, credits: 6, gradesOffered: [9] });
  });
  it("labels letter grades readably", () => {
    expect(gradeLabel("A_MINUS")).toBe("A-");
    expect(gradeLabel("PASS")).toBe("Pass");
    expect(gradeLabel(null)).toBe("");
  });
  it("offers exactly the grades the server accepts", () => {
    expect(GRADE_OPTIONS.map((g) => g.value).sort()).toEqual([...LETTER_GRADES].sort());
  });
});
