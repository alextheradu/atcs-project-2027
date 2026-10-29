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

  it("passes the student's 8th grade math through", () => {
    const geo = mk("geometry", 9, { type: "priorCoursework", field: "eighthMath", minGrade: "D" });
    const r = evaluatePlan([geo], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "B" } });
    expect(r.get("geometry")?.status).toBe("ELIGIBLE");
  });
});

describe("eligibilityWarnings", () => {
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
      [12, "ELIGIBLE_WITH_WARNING"],
    ]);
  });
  it("ignores the course itself and middle school grades", () => {
    const fit = courseFit({ ...calc, gradesOffered: [8, 11] }, [mk("calculus", 11, null)]);
    expect(fit.map((f) => f.grade)).toEqual([11]);
  });
});
