import { describe, expect, it } from "vitest";
import type { Rule } from "@/lib/eligibility";
import { canEditDepartment, canEditEdge, wouldCycle } from "./scope";
import { addChild, asGroup, blankLeaf, getAt, moveAt, problems, removeAt, setGroupType, tidy, updateAt } from "./tree";

describe("scope", () => {
  const sup = { role: "SUPERVISOR" as const, departments: ["MATH", "COMPUTER_SCIENCE"] as const };
  it("admins edit anything", () => {
    expect(canEditDepartment({ role: "ADMIN", departments: [] }, "ART")).toBe(true);
  });
  it("supervisors edit only their own departments", () => {
    expect(canEditDepartment(sup, "MATH")).toBe(true);
    expect(canEditDepartment(sup, "SCIENCE")).toBe(false);
  });
  it("nobody else edits", () => {
    for (const role of ["COUNSELOR", "STUDENT", "INCOMING"] as const) {
      expect(canEditDepartment({ role, departments: ["MATH"] }, "MATH")).toBe(false);
    }
  });
  it("an edge needs both ends in scope", () => {
    expect(canEditEdge(sup, "MATH", "COMPUTER_SCIENCE")).toBe(true);
    expect(canEditEdge(sup, "MATH", "SCIENCE")).toBe(false);
    expect(canEditEdge(sup, "SCIENCE", "MATH")).toBe(false);
  });
});

describe("wouldCycle", () => {
  const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }];
  it("rejects loops, direct and indirect", () => {
    expect(wouldCycle(edges, "a", "a")).toBe(true);
    expect(wouldCycle(edges, "c", "a")).toBe(true);
    expect(wouldCycle(edges, "b", "a")).toBe(true);
  });
  it("allows forward and unrelated edges", () => {
    expect(wouldCycle(edges, "a", "c")).toBe(false);
    expect(wouldCycle(edges, "x", "a")).toBe(false);
  });
});

describe("tree edits", () => {
  const leaf = (c: string): Rule => ({ type: "completed", courses: [c] });
  const root: Rule = { type: "all", rules: [leaf("a"), { type: "any", rules: [leaf("b"), leaf("c")] }] };

  it("reads and updates nested nodes without touching the original", () => {
    expect(getAt(root, [1, 0])).toEqual(leaf("b"));
    const next = updateAt(root, [1, 0], () => leaf("z"));
    expect(getAt(next, [1, 0])).toEqual(leaf("z"));
    expect(getAt(root, [1, 0])).toEqual(leaf("b"));
  });
  it("ignores paths that do not exist", () => {
    expect(updateAt(root, [5], () => leaf("z"))).toBe(root);
    expect(getAt(root, [0, 0])).toBeNull();
  });
  it("adds, removes and moves children", () => {
    expect((addChild(root, [1], leaf("d")) as Extract<Rule, { rules: Rule[] }>).rules[1]).toMatchObject({ rules: [leaf("b"), leaf("c"), leaf("d")] });
    expect((removeAt(root, [0]) as Extract<Rule, { rules: Rule[] }>).rules).toHaveLength(1);
    expect(removeAt(root, [])).toBe(root);
    expect(getAt(moveAt(root, [0], 1), [1])).toEqual(leaf("a"));
    expect(moveAt(root, [0], -1)).toEqual(root);
  });
  it("adds only to groups", () => {
    expect(addChild(leaf("a"), [], leaf("b"))).toEqual(leaf("a"));
  });
  it("switches a group between all and any", () => {
    expect(setGroupType(root, [1], "all")).toMatchObject({ rules: [expect.anything(), { type: "all" }] });
  });
  it("wraps a lone leaf and starts empty rules as a group", () => {
    expect(asGroup(leaf("a"))).toEqual({ type: "all", rules: [leaf("a")] });
    expect(asGroup(null)).toEqual({ type: "all", rules: [] });
    expect(asGroup(root)).toBe(root);
  });
  it("tidy drops empty groups and unwraps single children", () => {
    expect(tidy({ type: "all", rules: [] })).toBeNull();
    expect(tidy({ type: "all", rules: [leaf("a")] })).toEqual(leaf("a"));
    expect(tidy({ type: "all", rules: [{ type: "any", rules: [] }, leaf("a")] })).toEqual(leaf("a"));
    expect(tidy(root)).toEqual(root);
  });
  it("reports what blocks saving", () => {
    expect(problems(null)).toEqual([]);
    expect(problems(blankLeaf("completed"))).toHaveLength(1);
    expect(problems({ type: "all", rules: [blankLeaf("manual"), blankLeaf("gradeLevel")] })).toEqual(["Give each manual requirement a label."]);
    expect(problems({ type: "gradeLevel", in: [] })).toHaveLength(1);
    expect(problems(leaf("a"))).toEqual([]);
  });
  it("every blank leaf has a type the engine knows", () => {
    for (const t of ["completed", "minGrade", "gradeLevel", "coreq", "priorCoursework", "manual"] as const) {
      expect(blankLeaf(t).type).toBe(t);
    }
  });
});

import { describeRule } from "./describe";

describe("describeRule", () => {
  it("distinguishes taking courses together from taking one earlier", () => {
    expect(describeRule({ type: "coreq", courses: ["macro"], timing: "sameYear" }, { macro: "AP Macroeconomics" }))
      .toBe("AP Macroeconomics in the same school year");
    expect(describeRule({ type: "coreq", courses: ["macro"], timing: "sameOrEarlier" }))
      .toBe("macro in the same year or earlier");
  });
  const names = { "honors-geometry": "Honors Geometry", "geometry-enhanced": "Geometry Enhanced" };
  it("reads the Honors Algebra II example in plain words", () => {
    const r: Rule = {
      type: "all",
      rules: [
        { type: "any", rules: [
          { type: "minGrade", courses: ["honors-geometry"], grade: "B", basis: "initialAverage" },
          { type: "all", rules: [{ type: "minGrade", courses: ["geometry-enhanced"], grade: "A", basis: "initialAverage" }, { type: "manual", label: "Placement exam" }] },
        ] },
        { type: "manual", label: "Recommendation" },
      ],
    };
    expect(describeRule(r, names)).toBe(
      "one of: (B or higher in Honors Geometry) or (A or higher in Geometry Enhanced; and Placement exam (checked by a person)); and Recommendation (checked by a person)",
    );
  });
  it("falls back to slugs and covers every leaf", () => {
    expect(describeRule({ type: "completed", courses: ["x", "y"] })).toBe("completed x or y");
    expect(describeRule({ type: "gradeLevel", in: [10, 11] })).toBe("grade 10, 11");
    expect(describeRule({ type: "coreq", courses: ["x"] })).toBe("x in the same year or earlier");
    expect(describeRule({ type: "priorCoursework", field: "eighthMath", value: "ALGEBRA_I", minGrade: "C_PLUS" })).toBe("8th grade Algebra I with C+ or higher");
    expect(describeRule({ type: "priorCoursework", field: "eighthMath" })).toBe("8th grade math");
  });
});
