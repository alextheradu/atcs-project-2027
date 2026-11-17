import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import type { EvalContext, Rule, TakenCourse } from "./types";
import { waysIn } from "./ways";

const done = (slug: string, grade: TakenCourse["grade"], gradeLevel = 9): TakenCourse => ({ slug, status: "COMPLETED", grade, gradeLevel });
const ctx = (gradeLevel: number, taken: TakenCourse[] = []): EvalContext => ({ gradeLevel, taken });

// Honors CS, simplified: (Honors Algebra II alongside, and interest) or (Intro to CS, and interest), plus a recommendation.
const honorsCs: Rule = {
  type: "all",
  rules: [
    {
      type: "any",
      rules: [
        { type: "coreq", courses: ["honors-alg-ii", "alg-ii-enhanced"] },
        { type: "completed", courses: ["intro-cs"] },
      ],
    },
    { type: "manual", label: "Recommendation of teacher and supervisor" },
  ],
};

describe("waysIn", () => {
  it("lists every route still open, shortest first, each with the classes that would fix it", () => {
    const r = evaluate(honorsCs, ctx(11, [done("alg-ii", "B", 10)]));
    const ways = waysIn(r.tree);
    expect(ways).toHaveLength(2);
    expect(ways.map((w) => w.steps.map((s) => ({ kind: s.kind, courses: s.courses })))).toEqual([
      [{ kind: "alongside", courses: ["honors-alg-ii", "alg-ii-enhanced"] }],
      [{ kind: "before", courses: ["intro-cs"] }],
    ]);
  });
  it("has nothing to say when the requirement is met", () => {
    expect(waysIn(evaluate(honorsCs, ctx(11, [done("intro-cs", "A", 10)])).tree)).toEqual([]);
  });
  it("needs every unmet step of an all group in the same route", () => {
    const both: Rule = { type: "all", rules: [{ type: "completed", courses: ["a"] }, { type: "minGrade", courses: ["b"], grade: "B", basis: "final" }] };
    const ways = waysIn(evaluate(both, ctx(11)).tree);
    expect(ways).toHaveLength(1);
    expect(ways[0].steps.map((s) => s.kind)).toEqual(["before", "before"]);
  });
  it("drops steps nobody can add from the board, like a grade level", () => {
    const r = evaluate({ type: "gradeLevel", in: [12] }, ctx(11));
    expect(waysIn(r.tree)).toEqual([{ steps: [{ kind: "other", courses: [], message: "Only for grade 12." }] }]);
  });
  it("merges a route that takes the same classes earlier into the one that allows them alongside", () => {
    const either: Rule = { type: "any", rules: [{ type: "completed", courses: ["alg-ii-h"] }, { type: "coreq", courses: ["alg-ii-h"] }, { type: "completed", courses: ["intro-cs"] }] };
    const ways = waysIn(evaluate(either, ctx(11)).tree);
    expect(ways.map((w) => w.steps.map((s) => [s.kind, s.courses]))).toEqual([[["alongside", ["alg-ii-h"]]], [["before", ["intro-cs"]]]]);
  });
  it("keeps at most three routes", () => {
    const many: Rule = { type: "any", rules: ["a", "b", "c", "d", "e"].map((c) => ({ type: "completed", courses: [c] }) as Rule) };
    expect(waysIn(evaluate(many, ctx(11)).tree)).toHaveLength(3);
  });
});
