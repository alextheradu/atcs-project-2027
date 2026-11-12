import { describe, expect, it } from "vitest";
import { eligibilityWarnings, evaluatePlan, type PlanCourse } from "./plan";
import type { Rule } from "./types";

const mk = (key: string, gradeLevel: number, rules: Rule | null, more: Partial<PlanCourse> = {}): PlanCourse => ({
  key,
  slug: key,
  name: key.toUpperCase(),
  gradeLevel,
  status: "PLANNED",
  grade: null,
  rules,
  prereqText: null,
  approvedAppeal: false,
  ...more,
});

describe("evaluatePlan", () => {
  const calc = mk("calculus", 11, { type: "minGrade", courses: ["pre-calculus"], grade: "B_MINUS", basis: "final" });

  it("judges each placement against the rest of the plan", () => {
    const ok = evaluatePlan([mk("pre-calculus", 10, null, { status: "COMPLETED", grade: "B" }), calc]);
    expect(ok.get("calculus")?.status).toBe("ELIGIBLE");
    expect(evaluatePlan([calc]).get("calculus")?.status).toBe("NOT_ELIGIBLE_LOCKED");
  });

  it("notices when a prerequisite is moved to a later year", () => {
    const r = evaluatePlan([mk("pre-calculus", 12, null), calc]);
    expect(r.get("calculus")?.status).toBe("NOT_ELIGIBLE_LOCKED");
  });

  it("an approved appeal on the entry overrides the miss", () => {
    const r = evaluatePlan([{ ...calc, approvedAppeal: true }]);
    expect(r.get("calculus")?.viaAppeal).toBe(true);
  });

  it("does not check classes the student finished or is taking now", () => {
    const geo = mk("geometry", 9, { type: "priorCoursework", field: "eighthMath", minGrade: "D" }, { status: "COMPLETED", grade: "B_PLUS" });
    const cs = mk("honors-cs", 10, { type: "completed", courses: ["intro-cs"] }, { status: "IN_PROGRESS" });
    const r = evaluatePlan([geo, cs]);
    expect(r.get("geometry")).toMatchObject({ status: "ELIGIBLE", taken: true, summary: "You took this class." });
    expect(r.get("honors-cs")).toMatchObject({ status: "ELIGIBLE", taken: true, summary: "You are taking this class now." });
    expect(eligibilityWarnings([geo, cs], r)).toEqual([]);
  });

  it("counts a prerequisite planned in an earlier year as covered", () => {
    const eng4 = mk("english-iv", 12, { type: "completed", courses: ["english-iii"] });
    const r = evaluatePlan([mk("english-iii", 11, null), eng4]);
    expect(r.get("english-iv")?.status).toBe("ELIGIBLE");
    expect(r.get("english-iv")?.leaves[0]).toMatchObject({ state: "planned", message: "english-iii is planned for grade 11." });
  });

  it("passes the student's 8th grade math through", () => {
    const geo = mk("geometry", 9, { type: "priorCoursework", field: "eighthMath", minGrade: "D" });
    const r = evaluatePlan([geo], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "B" } });
    expect(r.get("geometry")?.status).toBe("ELIGIBLE");
  });
});

describe("eligibilityWarnings", () => {
  it("warns for both split co-requisites and clears both warnings when reunited", () => {
    const micro = mk("micro", 11, { type: "coreq", courses: ["macro"], timing: "sameYear" });
    const macro = mk("macro", 12, { type: "coreq", courses: ["micro"], timing: "sameYear" });
    const split = [micro, macro];
    expect(eligibilityWarnings(split, evaluatePlan(split)).map((w) => [w.entryId, w.code]))
      .toEqual([["micro", "MISSING_COREQ"], ["macro", "MISSING_COREQ"]]);
    const together = [micro, { ...macro, gradeLevel: 11 }];
    expect(eligibilityWarnings(together, evaluatePlan(together))).toEqual([]);
    expect(eligibilityWarnings([micro], evaluatePlan([micro]))).toMatchObject([{ entryId: "micro", code: "MISSING_COREQ" }]);
  });

  it("raises prerequisite and co-requisite warnings only for failures", () => {
    const micro = mk("micro", 11, { type: "coreq", courses: ["macro"] });
    const calc = mk("calc", 11, { type: "completed", courses: ["pre"] });
    const manual = mk("choir", 10, { type: "manual", label: "Audition" });
    const courses = [micro, calc, manual];
    const w = eligibilityWarnings(courses, evaluatePlan(courses));
    expect(w.map((x) => [x.entryId, x.code])).toEqual([
      ["micro", "MISSING_COREQ"],
      ["calc", "UNMET_PREREQ"],
    ]);
  });
});

import { courseFit } from "./course-fit";

describe("courseFit", () => {
  const calc = { slug: "calculus", gradesOffered: [11, 12], prereqText: "x", rules: { type: "minGrade", courses: ["pre-calculus"], grade: "B_MINUS", basis: "final" } as Rule };
  it("checks each grade the course is offered in against the rest of the plan", () => {
    const fit = courseFit(calc, [mk("pre-calculus", 11, null)]);
    expect(fit.map((f) => [f.grade, f.result.status])).toEqual([
      [11, "NOT_ELIGIBLE_LOCKED"],
      [12, "ELIGIBLE"],
    ]);
  });
  it("ignores the course itself and middle school grades", () => {
    const fit = courseFit({ ...calc, gradesOffered: [8, 11] }, [mk("calculus", 11, null)]);
    expect(fit.map((f) => f.grade)).toEqual([11]);
  });
});
