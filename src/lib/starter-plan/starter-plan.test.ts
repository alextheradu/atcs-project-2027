import { describe, expect, it } from "vitest";
import { buildStarterPlan, type StarterCourse } from "./index";

const c = (slug: string, kinds: string[], more: Partial<StarterCourse> = {}): StarterCourse => ({
  id: slug, slug, name: slug.replace(/-/g, " "), level: "CP", credits: 5, gradesOffered: [9], interests: [], kinds, hasPrereq: false, plannable: true, ...more,
});

const catalog: StarterCourse[] = [
  c("english-i", ["ENGLISH"]),
  c("honors-english-i", ["ENGLISH"], { level: "HONORS" }),
  c("world-history", ["SOCIAL_STUDIES"]),
  c("themes-in-world-history", ["SOCIAL_STUDIES"]),
  c("biology", ["SCI_BIO"]),
  c("biology-enhanced", ["SCI_BIO"], { level: "ENHANCED" }),
  c("algebra-ii", ["MATH"], { hasPrereq: true }),
  c("geometry", ["MATH"], { hasPrereq: true }),
  c("geometry-enhanced", ["MATH"], { level: "ENHANCED", hasPrereq: true }),
  c("honors-algebra-ii-with-trigonometry", ["MATH"], { level: "HONORS", hasPrereq: true }),
  c("physical-education-health-9", ["PE_HEALTH"]),
  c("spanish-i", ["WORLD_LANG"]),
  c("spanish-ii", ["WORLD_LANG"]),
  c("french-i", ["WORLD_LANG"]),
  c("studio-art-i", ["ARTS"], { interests: ["art-design"] }),
  c("robotics", ["LIFE_CAREERS"], { interests: ["engineering-building", "coding-cs"] }),
  c("intro-cs", ["LIFE_CAREERS"], { interests: ["coding-cs"] }),
  c("band", ["ARTS"], { interests: ["music-performing"] }),
  c("ap-history", ["SOCIAL_STUDIES"], { level: "AP" }),
  c("senior-only", ["ARTS"], { gradesOffered: [12], interests: ["coding-cs"] }),
  c("needs-prereq", ["ARTS"], { hasPrereq: true, interests: ["coding-cs"] }),
];

const base = { interests: ["coding-cs"], eighthMath: "PRE_ALGEBRA" as const };

describe("buildStarterPlan", () => {
  it("is labeled self-reported", () => {
    expect(buildStarterPlan(catalog, base).label).toBe("Based on self-reported info");
  });

  it("puts required 9th grade courses first", () => {
    const slugs = buildStarterPlan(catalog, base).picks.map((p) => p.slug);
    expect(slugs.slice(0, 6)).toEqual(["english-i", "world-history", "biology", "geometry", "physical-education-health-9", "french-i"]);
  });

  it("ranks electives by interest overlap and skips ineligible ones", () => {
    const plan = buildStarterPlan(catalog, { ...base, interests: ["coding-cs", "engineering-building"] });
    const electives = plan.picks.filter((p) => p.role === "elective").map((p) => p.slug);
    expect(electives[0]).toBe("robotics");
    expect(electives).toContain("intro-cs");
    expect(electives).not.toContain("senior-only");
    expect(electives).not.toContain("needs-prereq");
    expect(plan.picks.some((p) => p.slug === "ap-history" || p.slug === "honors-english-i")).toBe(false);
  });

  it("keeps the year between 35 and 40 credits", () => {
    const plan = buildStarterPlan(catalog, { ...base, interests: ["coding-cs", "art-design", "music-performing"] });
    expect(plan.credits).toBeGreaterThanOrEqual(35);
    expect(plan.credits).toBeLessThanOrEqual(40);
  });

  it("marks the first beginner language as a guess", () => {
    const lang = buildStarterPlan(catalog, base).picks.find((p) => p.slug === "french-i")!;
    expect(lang.fit).toBe("worth considering, a supervisor decides");
  });

  it("is deterministic", () => {
    expect(buildStarterPlan(catalog, base)).toEqual(buildStarterPlan([...catalog].reverse(), base));
  });

  it("continues the language the student studied", () => {
    const p = buildStarterPlan(catalog, { ...base, language: { name: "spanish", level: 1 } });
    expect(p.picks.map((x) => x.slug)).toContain("spanish-ii");
  });

  it("suggests higher levels only as stretch options with careful wording", () => {
    const strongInput = { ...base, eighthMath: "ALGEBRA_I" as const, mathGrade: "A" as const, englishGrade: "A_PLUS" as const, scienceGrade: "A_MINUS" as const };
    const plan = buildStarterPlan(catalog, strongInput);
    expect(plan.stretch.map((s) => s.slug)).toEqual(["biology-enhanced", "geometry-enhanced", "honors-english-i"].sort((a, b) => plan.stretch.findIndex((s) => s.slug === a) - plan.stretch.findIndex((s) => s.slug === b)));
    expect(plan.stretch.length).toBe(3);
    for (const s of plan.stretch) expect(s.fit).toBe("worth considering, a supervisor decides");
    expect(plan.picks.every((p) => p.slug !== "honors-english-i")).toBe(true);
  });

  it("no stretch for ordinary grades, or for math without 8th grade Algebra I", () => {
    expect(buildStarterPlan(catalog, { ...base, englishGrade: "B" }).stretch).toEqual([]);
    expect(buildStarterPlan(catalog, { ...base, mathGrade: "A" }).stretch).toEqual([]);
  });

  it("never claims a placement", () => {
    const text = JSON.stringify(buildStarterPlan(catalog, { ...base, mathGrade: "A", eighthMath: "ALGEBRA_I" })).toLowerCase();
    expect(text).not.toContain("placed in");
    expect(text).not.toContain("you will take");
  });
});
