/** Rules checked against the real seed (prisma/seed/rules.json) and the PDF examples they came from. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { parseRule, ruleSlugs } from "./schema";
import type { EvalContext, Rule, TakenCourse } from "./types";

const seed = <T>(f: string): T => JSON.parse(readFileSync(path.resolve("prisma/seed", f), "utf8")) as T;
const courses = seed<{ slug: string; sourcePage: number; prereqText: string | null; gradesOffered: number[] }[]>("courses.json");
const rules = seed<{ slug: string; rules: Rule; pages: number[] }[]>("rules.json");
const edges = seed<{ from: string; to: string; track: string; kind: string }[]>("edges.json");
const DASH = String.fromCharCode(0x2014);
const slugs = new Set(courses.map((c) => c.slug));
const byCourse = new Map(courses.map((c) => [c.slug, c]));
const rule = (slug: string): Rule => {
  const r = rules.find((x) => x.slug === slug);
  if (!r) throw new Error(`no rule for ${slug}`);
  return r.rules;
};

const done = (slug: string, grade: TakenCourse["grade"], gradeLevel = 9): TakenCourse => ({ slug, status: "COMPLETED", grade, gradeLevel });
const plan = (slug: string, gradeLevel: number): TakenCourse => ({ slug, status: "PLANNED", gradeLevel });
const run = (slug: string, gradeLevel: number, taken: TakenCourse[] = [], more: Partial<EvalContext> = {}) =>
  evaluate(rule(slug), { gradeLevel, taken, ...more });

describe("seed integrity", () => {
  it("every rule parses, points at real courses, and cites a PDF page", () => {
    for (const r of rules) {
      expect(parseRule(r.rules), r.slug).not.toBeNull();
      expect(byCourse.has(r.slug), `unknown course ${r.slug}`).toBe(true);
      for (const s of ruleSlugs(r.rules)) expect(slugs.has(s), `${r.slug} refers to unknown ${s}`).toBe(true);
      expect(r.pages.length, `${r.slug} has no page`).toBeGreaterThan(0);
      expect(r.pages, `${r.slug} cites the wrong page`).toContain(byCourse.get(r.slug)!.sourcePage);
    }
  });

  it("has one rule per course", () => {
    expect(new Set(rules.map((r) => r.slug)).size).toBe(rules.length);
  });

  it("encodes every course that has prerequisite text, apart from the listed gaps", () => {
    // Free text only: the PDF text is a vague placement, an audition, or contradicts itself.
    const gaps = new Set<string>();
    const missing = courses.filter((c) => c.prereqText && !rules.some((r) => r.slug === c.slug) && !gaps.has(c.slug));
    expect(missing.map((c) => c.slug)).toEqual([]);
  });

  it("edges point at real courses and are unique", () => {
    const seen = new Set<string>();
    for (const e of edges) {
      expect(slugs.has(e.from) && slugs.has(e.to), `${e.from} -> ${e.to}`).toBe(true);
      expect(e.from).not.toBe(e.to);
      const key = `${e.from}>${e.to}`;
      expect(seen.has(key), `duplicate edge ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("no manual leaf pretends to be a check: every manual label is plain text", () => {
    const labels: string[] = [];
    const visit = (r: Rule) => {
      if (r.type === "all" || r.type === "any") r.rules.forEach(visit);
      else if (r.type === "manual") labels.push(r.label);
    };
    rules.forEach((r) => visit(r.rules));
    expect(labels.length).toBeGreaterThan(20);
    for (const l of labels) expect(l.includes(DASH)).toBe(false);
  });

  it("uses no em dashes anywhere in the seed", () => {
    expect(readFileSync("prisma/seed/rules.json", "utf8").includes(DASH)).toBe(false);
    expect(readFileSync("prisma/seed/edges.json", "utf8").includes(DASH)).toBe(false);
  });
});

describe("math (p30-34)", () => {
  it("Honors Algebra II with Trigonometry: B in Honors Geometry works, with the recommendation still to come", () => {
    const r = run("honors-algebra-ii-with-trigonometry", 10, [done("honors-geometry", "B")]);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(r.summary).toBe("Recommendation of teacher and supervisor");
  });

  it("Honors Algebra II with Trigonometry: B- in Honors Geometry is appealable", () => {
    expect(run("honors-algebra-ii-with-trigonometry", 10, [done("honors-geometry", "B_MINUS")]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });

  it("Honors Algebra II with Trigonometry: A in Geometry Enhanced and Algebra I Enhanced adds the placement exam", () => {
    const r = run("honors-algebra-ii-with-trigonometry", 11, [done("geometry-enhanced", "A", 9), done("algebra-i-enhanced", "A", 10)]);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    const manuals = r.leaves.filter((l) => l.state === "manual").map((l) => l.message);
    expect(manuals).toContain("Proficiency on a placement exam");
  });

  it("Honors Algebra II with Trigonometry: A- in Geometry Enhanced is not enough", () => {
    const r = run("honors-algebra-ii-with-trigonometry", 11, [done("geometry-enhanced", "A_MINUS", 9), done("algebra-i-enhanced", "A", 10)]);
    expect(r.status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });

  it("Calculus: skipping Pre-Calculus is locked, a C+ in it is appealable, a B- passes", () => {
    expect(run("calculus", 11, [done("geometry", "A")]).status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(run("calculus", 11, [done("pre-calculus", "C_PLUS", 10)]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(run("calculus", 11, [done("pre-calculus", "B_MINUS", 10)]).status).toBe("ELIGIBLE");
  });

  it("AP Calculus BC needs B+ in AP Pre-Calculus", () => {
    expect(run("ap-calculus-bc", 12, [done("ap-pre-calculus", "B_PLUS", 11)]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("ap-calculus-bc", 12, [done("ap-pre-calculus", "B", 11)]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });

  it("Algebra I follows a passing grade in Geometry and Algebra II follows Algebra I", () => {
    expect(run("algebra-i", 10, [done("geometry", "D")]).status).toBe("ELIGIBLE");
    expect(run("algebra-i", 10, [done("geometry", "F")]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(run("algebra-ii-with-trigonometry", 11, [done("algebra-i", "C", 10)]).status).toBe("ELIGIBLE");
    expect(run("algebra-ii-with-trigonometry", 10, [plan("algebra-i", 10)], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "B" } }).status).toBe("NOT_ELIGIBLE_LOCKED");
  });

  it("an 8th grade Algebra I student can plan Algebra II with Trigonometry", () => {
    expect(run("algebra-ii-with-trigonometry", 10, [done("geometry", "B")], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "B" } }).status).toBe("ELIGIBLE");
  });

  it("Geometry needs a passing 8th grade math grade", () => {
    expect(run("geometry", 9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "C" } }).status).toBe("ELIGIBLE");
    expect(run("geometry", 9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "F" } }).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });

  it("Geometry Enhanced: C+ in 8th grade Algebra I or B- in 8th grade math, plus placement", () => {
    const e = (m: "ALGEBRA_I" | "PRE_ALGEBRA", g: "C_PLUS" | "C" | "B_MINUS") => run("geometry-enhanced", 9, [], { prior: { eighthMath: m, eighthMathGrade: g } });
    expect(e("ALGEBRA_I", "C_PLUS").status).toBe("ELIGIBLE_WITH_WARNING");
    expect(e("PRE_ALGEBRA", "B_MINUS").status).toBe("ELIGIBLE_WITH_WARNING");
    expect(e("PRE_ALGEBRA", "C_PLUS").status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });

  it("Honors Geometry is placement only after 8th grade Algebra I", () => {
    expect(run("honors-geometry", 9, [], { prior: { eighthMath: "ALGEBRA_I", eighthMathGrade: "A" } }).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("honors-geometry", 9, [], { prior: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: "A" } }).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
});

describe("computer science (p35-36)", () => {
  it("Intro to CS: Geometry in the same year satisfies the co-requisite", () => {
    expect(run("introduction-to-computer-science-and-app-development", 9, [plan("geometry", 9)]).status).toBe("ELIGIBLE");
    expect(run("introduction-to-computer-science-and-app-development", 9, []).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("Honors CS after Intro to CS still needs the recommendation", () => {
    const r = run("honors-computer-science", 10, [done("introduction-to-computer-science-and-app-development", "B")]);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(r.summary).toBe("Recommendation of teacher and supervisor");
  });
  it("AP CS A needs Honors CS, and Advanced Topics needs AP CS A", () => {
    expect(run("ap-computer-science-a", 11, []).status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(run("ap-computer-science-a", 11, [done("honors-computer-science", "A", 10)]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("advanced-topics-in-computer-science-honors", 12, [done("honors-computer-science", "A", 10)]).status).toBe("NOT_ELIGIBLE_LOCKED");
    expect(run("advanced-topics-in-computer-science-honors", 12, [done("ap-computer-science-a", "B", 11)]).status).toBe("ELIGIBLE_WITH_WARNING");
  });
});

describe("science (p39-45)", () => {
  it("Honors Chemistry: B in Honors Biology or A in Biology Enhanced", () => {
    expect(run("honors-chemistry", 10, [done("honors-biology", "B")]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("honors-chemistry", 10, [done("biology-enhanced", "A")]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("honors-chemistry", 10, [done("honors-biology", "B_MINUS")]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(run("honors-chemistry", 10, [done("biology-enhanced", "A_MINUS")]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("a suggested co-requisite warns but never blocks", () => {
    const r = run("chemistry", 10, [done("biology", "B")]);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(r.summary.startsWith("Suggested:")).toBe(true);
    expect(run("chemistry", 10, [done("biology", "B"), plan("algebra-i", 10)]).status).toBe("ELIGIBLE");
  });
  it("Physics needs Algebra II with Trigonometry in the same year or before", () => {
    expect(run("physics", 11, [plan("algebra-ii-with-trigonometry", 11)]).status).toBe("ELIGIBLE");
    expect(run("physics", 11, []).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("AP Environmental Science: Chemistry plus a Chemistry Enhanced or Physics Enhanced co-requisite", () => {
    expect(run("ap-environmental-science", 11, [done("chemistry", "B", 10), plan("physics-enhanced", 11)]).status).toBe("ELIGIBLE");
    expect(run("ap-environmental-science", 11, [done("chemistry", "B", 10)]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
  });
  it("Applied Physics lists two prerequisites in the PDF, so it is left to the supervisor", () => {
    const r = run("applied-physics-and-engineering", 11, []);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(r.summary).toContain("Science listing");
  });
});

describe("English and social studies (p16-27)", () => {
  it("English II follows any 9th grade English", () => {
    expect(run("english-ii", 10, [done("honors-english-i", "B")]).status).toBe("ELIGIBLE");
    expect(run("english-ii", 10, []).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("American Studies needs 10th grade English and 10th grade U.S. History", () => {
    expect(run("american-studies", 11, [done("english-ii", "B", 10), done("u-s-history-i", "B", 10)]).status).toBe("ELIGIBLE");
    expect(run("american-studies", 11, [done("english-ii", "B", 10)]).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
  it("AP Microeconomics and AP Macroeconomics are taken together", () => {
    expect(run("ap-microeconomics", 11, []).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(run("ap-microeconomics", 11, [plan("ap-macroeconomics", 11)]).status).toBe("ELIGIBLE");
    expect(run("ap-macroeconomics", 11, [plan("ap-microeconomics", 11)]).status).toBe("ELIGIBLE");
    for (const [target, companion] of [["ap-microeconomics", "ap-macroeconomics"], ["ap-macroeconomics", "ap-microeconomics"]]) {
      expect(run(target, 12, [plan(companion, 11)]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
      expect(run(target, 12, [done(companion, "B", 11)]).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    }
  });
  it("AP Government and the Syracuse public policy course are taken together", () => {
    expect(run("ap-american-government-and-politics", 12, []).status).toBe("NOT_ELIGIBLE_APPEALABLE");
    expect(run("ap-american-government-and-politics", 12, [plan("an-introduction-to-the-analysis-of-public-policy", 12)]).status).toBe("ELIGIBLE");
    expect(run("an-introduction-to-the-analysis-of-public-policy", 12, [plan("ap-american-government-and-politics", 12)]).status).toBe("ELIGIBLE");
  });
  it("AP U.S. History I: World History plus placement", () => {
    expect(run("ap-u-s-history-i", 10, [done("world-history", "A")]).status).toBe("ELIGIBLE_WITH_WARNING");
  });
});

describe("world language (p47-49)", () => {
  it("AP language courses are an honors sequence plus a recommendation: always manual", () => {
    const r = run("ap-spanish-language-and-culture", 11, [done("honors-spanish-iv", "A", 10)]);
    expect(r.status).toBe("ELIGIBLE_WITH_WARNING");
    expect(r.summary).toContain("Honors language sequence");
  });
  it("AP Spanish Literature accepts AP Spanish Language or Heritage Speakers III", () => {
    expect(run("ap-spanish-literature-and-culture", 12, [done("ap-spanish-language-and-culture", "B", 11)]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("ap-spanish-literature-and-culture", 12, [done("spanish-for-heritage-speakers-iii", "B", 11)]).status).toBe("ELIGIBLE_WITH_WARNING");
    expect(run("ap-spanish-literature-and-culture", 12, [done("spanish-iii", "A", 10)]).status).toBe("NOT_ELIGIBLE_LOCKED");
  });
});

describe("approved appeals on a plan entry", () => {
  it("Calculus with a C+ in Pre-Calculus becomes Approved via appeal", () => {
    const r = run("calculus", 11, [done("pre-calculus", "C_PLUS", 10)], { approvedAppeal: true });
    expect(r.status).toBe("ELIGIBLE");
    expect(r.summary).toBe("Approved via appeal.");
  });
});
