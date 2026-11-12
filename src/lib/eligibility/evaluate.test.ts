import { describe, expect, it } from "vitest";
import { evaluate, evaluateCourse } from "./evaluate";
import type { EvalContext, Rule, TakenCourse } from "./types";

const done = (slug: string, grade: TakenCourse["grade"], gradeLevel = 9): TakenCourse => ({ slug, status: "COMPLETED", grade, gradeLevel });
const planned = (slug: string, gradeLevel: number): TakenCourse => ({ slug, status: "PLANNED", gradeLevel });
const ctx = (gradeLevel: number, taken: TakenCourse[] = [], more: Partial<EvalContext> = {}): EvalContext => ({ gradeLevel, taken, ...more });

describe("completed", () => {
  const rule: Rule = { type: "completed", courses: ["english-i", "honors-english-i"] };

  it("is met by any listed course", () => {
    expect(evaluate(rule, ctx(10, [done("honors-english-i", "B")])).status).toBe("ELIGIBLE");
  });
  it("accepts a completed course with no grade entered", () => {
    expect(evaluate(rule, ctx(10, [done("english-i", null)])).status).toBe("ELIGIBLE");
  });
  it("counts a prerequisite planned in an earlier year, and keeps it as a note", () => {
    const r = evaluate(rule, ctx(10, [planned("english-i", 9)]));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.leaves[0]).toMatchObject({ state: "planned" });
    expect(r.leaves[0].message).toContain("planned for grade 9");
  });
  it("fails when the prerequisite is planned in the same year or later, and locks it", () => {
    expect(evaluate(rule, ctx(10, [planned("english-i", 10)])).status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(evaluate(rule, ctx(10, [planned("english-i", 11)])).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("treats a failed prerequisite as appealable", () => {
    expect(evaluate(rule, ctx(10, [done("english-i", "F")])).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("locks a skipped prerequisite", () => {
    const r = evaluate(rule, ctx(10));
    expect(r.status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(r.unmet).toHaveLength(1);
  });
  it("lets a leaf override the default", () => {
    const r = evaluate({ ...rule, appealable: true } as Rule, ctx(10));
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("uses course names in messages when given", () => {
    const r = evaluate(rule, ctx(10, [], { names: { "english-i": "English I", "honors-english-i": "Honors English I" } }));
    expect(r.summary).toBe("Needs English I or Honors English I.");
  });
});

describe("minGrade", () => {
  const rule: Rule = { type: "minGrade", courses: ["pre-calculus"], grade: "B_MINUS", basis: "initialAverage" };

  it("passes exactly at the threshold and above", () => {
    expect(evaluate(rule, ctx(11, [done("pre-calculus", "B_MINUS")])).status).toBe("ELIGIBLE");
    expect(evaluate(rule, ctx(11, [done("pre-calculus", "A")])).status).toBe("ELIGIBLE");
  });
  it("is appealable one step below, and says what the student has", () => {
    const r = evaluate(rule, ctx(11, [done("pre-calculus", "C_PLUS")]));
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(r.summary).toContain("C+");
    expect(r.summary).toContain("B- or higher");
  });
  it("labels the final grade as an estimate when the PDF says initial average", () => {
    expect(evaluate(rule, ctx(11, [done("pre-calculus", "A")])).leaves[0].message).toContain("your final grade is only an estimate");
    const fin: Rule = { ...rule, basis: "final" } as Rule;
    expect(evaluate(fin, ctx(11, [done("pre-calculus", "A")])).leaves[0].message).not.toContain("only an estimate");
  });
  it("locks a skipped course", () => {
    expect(evaluate(rule, ctx(11, [done("geometry", "A")])).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("warns when the grade is not entered", () => {
    expect(evaluate(rule, ctx(11, [done("pre-calculus", null)])).status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("counts a course planned earlier and says what grade it will need", () => {
    const r = evaluate(rule, ctx(11, [planned("pre-calculus", 10)]));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.leaves[0].state).toBe("planned");
    expect(r.leaves[0].message).toContain("B- or higher");
  });
  it("warns instead of guessing when the grade is Pass", () => {
    expect(evaluate(rule, ctx(11, [done("pre-calculus", "PASS")])).status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("takes the best of several listed courses", () => {
    const r: Rule = { type: "minGrade", courses: ["a", "b"], grade: "B", basis: "final" };
    expect(evaluate(r, ctx(11, [done("a", "C"), done("b", "A_MINUS")])).status).toBe("ELIGIBLE");
  });
});

describe("any and all", () => {
  const a: Rule = { type: "completed", courses: ["a"] };
  const b: Rule = { type: "completed", courses: ["b"] };
  it("all takes the worst leaf", () => {
    expect(evaluate({ type: "all", rules: [a, b] }, ctx(10, [done("a", "A"), planned("b", 9)])).status).toBe("ELIGIBLE");
    const graded: Rule = { type: "minGrade", courses: ["b"], grade: "B", basis: "final" };
    expect(evaluate({ type: "all", rules: [a, graded] }, ctx(10, [done("a", "A"), done("b", null)])).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(evaluate({ type: "all", rules: [a, b] }, ctx(10, [done("a", "A")])).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("any takes the best branch and only explains the closest one", () => {
    const r = evaluate({ type: "any", rules: [a, { ...b, appealable: true } as Rule] }, ctx(10));
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(r.unmet).toHaveLength(1);
    expect(evaluate({ type: "any", rules: [a, b] }, ctx(10, [done("b", "C")])).status).toBe("ELIGIBLE");
  });
  it("empty lists ask for nothing", () => {
    expect(evaluate({ type: "all", rules: [] }, ctx(10)).status).toBe("ELIGIBLE");
    expect(evaluate({ type: "any", rules: [] }, ctx(10)).status).toBe("ELIGIBLE");
  });
  it("no rule means no prerequisites", () => {
    expect(evaluate(null, ctx(10)).status).toBe("ELIGIBLE");
  });
});

describe("grade wording", () => {
  it("uses an before A and F", () => {
    const rule: Rule = { type: "minGrade", courses: ["x"], grade: "A_MINUS", basis: "final" };
    expect(evaluate(rule, ctx(11, [done("x", "B")])).summary).toBe("You have a B in x. This needs an A- or higher.");
    expect(evaluate(rule, ctx(11, [done("x", "F")])).summary).toContain("You have an F in x.");
  });
});

describe("manual", () => {
  const manual: Rule = { type: "manual", label: "Audition" };
  it("never passes or fails: it is a note, not a warning", () => {
    const r = evaluate(manual, ctx(10));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.summary).toBe("Audition");
    expect(r.notes).toEqual(["Audition"]);
    expect(r.unmet).toHaveLength(0);
  });
  it("is the fallback in an any group when the other branch fails", () => {
    const r = evaluate({ type: "any", rules: [{ type: "completed", courses: ["x"] }, manual] }, ctx(10));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.notes).toEqual(["Audition"]);
  });
  it("loses to something the student still has to add", () => {
    const graded: Rule = { type: "minGrade", courses: ["x"], grade: "B", basis: "final" };
    expect(evaluate({ type: "all", rules: [manual, graded] }, ctx(10, [done("x", null)])).status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("does not hide a real failure", () => {
    const r = evaluate({ type: "all", rules: [manual, { type: "completed", courses: ["x"] }] }, ctx(10));
    expect(r.status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("does not raise a met requirement to a failure, and drops the note when another branch is met", () => {
    const r = evaluate({ type: "any", rules: [{ type: "completed", courses: ["x"] }, manual] }, ctx(10, [done("x", "B")]));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.notes).toEqual([]);
  });
});

describe("advisory leaves", () => {
  it("warn when unmet and never fail", () => {
    const r: Rule = { type: "coreq", courses: ["algebra-i"], advisory: true };
    const out = evaluate(r, ctx(10));
    expect(out.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(out.summary.startsWith("Suggested:")).toBe(true);
  });
  it("are met normally when satisfied", () => {
    expect(evaluate({ type: "coreq", courses: ["algebra-i"], advisory: true }, ctx(10, [done("algebra-i", "B")])).status).toBe("ELIGIBLE");
  });
});

describe("coreq", () => {
  const rule: Rule = { type: "coreq", courses: ["ap-macroeconomics"] };
  it("is met by the same year, an earlier year, or a completed course", () => {
    expect(evaluate(rule, ctx(11, [planned("ap-macroeconomics", 11)])).status).toBe("ELIGIBLE");
    expect(evaluate(rule, ctx(11, [planned("ap-macroeconomics", 10)])).status).toBe("ELIGIBLE");
    expect(evaluate(rule, ctx(11, [done("ap-macroeconomics", "B", 10)])).status).toBe("ELIGIBLE");
  });
  it("is appealable and tells the student what to add when missing", () => {
    const r = evaluate(rule, ctx(11, [], { names: { "ap-macroeconomics": "AP Macroeconomics" } }));
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(r.summary).toBe("Take AP Macroeconomics in grade 11 too, or finish it first.");
  });
  it("is unmet when the other course comes later, or was failed", () => {
    expect(evaluate(rule, ctx(11, [planned("ap-macroeconomics", 12)])).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(evaluate(rule, ctx(11, [done("ap-macroeconomics", "F", 10)])).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
});

describe("same-year co-requisites", () => {
  const rule: Rule = { type: "coreq", courses: ["ap-macroeconomics"], timing: "sameYear" };

  it.each(["PLANNED", "IN_PROGRESS", "COMPLETED"] as const)("accepts a passing companion in the same year with status %s", (status) => {
    expect(evaluate(rule, ctx(11, [{ slug: "ap-macroeconomics", gradeLevel: 11, status, grade: status === "COMPLETED" ? "B" : null }])).status).toBe("ELIGIBLE");
  });

  it.each([10, 12])("rejects a companion in grade %i, even when completed", (year) => {
    for (const entry of [planned("ap-macroeconomics", year), done("ap-macroeconomics", "B", year)]) {
      const r = evaluate(rule, ctx(11, [entry]));
      expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
      expect(r.summary).toContain("same school year");
      expect(r.summary).not.toContain("or earlier");
    }
  });

  it("explains a missing companion using its name and target year", () => {
    expect(evaluate(rule, ctx(11, [], { names: { "ap-macroeconomics": "AP Macroeconomics" } })).summary)
      .toBe("Take AP Macroeconomics in grade 11, in the same school year as this course.");
  });

  it("does not count a failed companion and explains the failure", () => {
    const r = evaluate(rule, ctx(11, [done("ap-macroeconomics", "F", 11)]));
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(r.summary).toContain("did not pass");
  });

  it("checks all alternatives instead of stopping at the first mismatch", () => {
    const either: Rule = { ...rule, courses: ["other", "ap-macroeconomics"] };
    expect(evaluate(either, ctx(11, [planned("other", 10), planned("ap-macroeconomics", 11)])).status).toBe("ELIGIBLE");
  });
});

describe("priorCoursework and gradeLevel", () => {
  const algI: Rule = { type: "priorCoursework", field: "eighthMath", value: "ALGEBRA_I", minGrade: "C_PLUS" };
  it("asks for the profile when 8th grade math is unknown", () => {
    expect(evaluate(algI, ctx(9)).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(evaluate(algI, ctx(9, [], { prior: { eighthMath: "UNSURE" } })).status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("checks the course and the grade", () => {
    expect(evaluate(algI, ctx(9, [], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "C_PLUS" } })).status).toBe("ELIGIBLE");
    expect(evaluate(algI, ctx(9, [], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "C" } })).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(evaluate(algI, ctx(9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "A" } })).status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(evaluate(algI, ctx(9, [], { prior: { eighthMath: "ALGEBRA_I" } })).status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("accepts any 8th grade math when no value is set", () => {
    const any: Rule = { type: "priorCoursework", field: "eighthMath", minGrade: "D" };
    expect(evaluate(any, ctx(9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "D" } })).status).toBe("ELIGIBLE");
    expect(evaluate(any, ctx(9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "F" } })).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("locks a course outside its grade levels", () => {
    const g: Rule = { type: "gradeLevel", in: [10, 11, 12] };
    expect(evaluate(g, ctx(10)).status).toBe("ELIGIBLE");
    expect(evaluate(g, ctx(9)).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
});

describe("approved appeal", () => {
  const rule: Rule = { type: "minGrade", courses: ["pre-calculus"], grade: "B_MINUS", basis: "final" };
  it("turns a miss into Approved via appeal", () => {
    const r = evaluate(rule, ctx(11, [done("pre-calculus", "C")], { approvedAppeal: true }));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.viaAppeal).toBe(true);
    expect(r.summary).toBe("Approved through a placement review.");
  });
  it("overrides a locked miss too", () => {
    expect(evaluate(rule, ctx(11, [], { approvedAppeal: true })).viaAppeal).toBe(true);
  });
  it("does not claim an appeal when none was needed", () => {
    const r = evaluate(rule, ctx(11, [done("pre-calculus", "A")], { approvedAppeal: true }));
    expect(r.status).toBe("ELIGIBLE");
    expect(r.viaAppeal).toBe(false);
  });
});

describe("evaluateCourse", () => {
  it("warns instead of passing when the PDF lists a prerequisite that was not encoded", () => {
    const r = evaluateCourse({ rules: null, prereqText: "Prerequisite: Something odd" }, ctx(10));
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
  });
  it("is eligible with no rule and no text", () => {
    expect(evaluateCourse({ rules: null, prereqText: null }, ctx(10)).status).toBe("ELIGIBLE");
    expect(evaluateCourse({ rules: undefined, prereqText: "  " }, ctx(10)).status).toBe("ELIGIBLE");
  });
  it("uses the rule when there is one", () => {
    const rules: Rule = { type: "completed", courses: ["a"] };
    expect(evaluateCourse({ rules, prereqText: "Prerequisite: A" }, ctx(10)).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
});
