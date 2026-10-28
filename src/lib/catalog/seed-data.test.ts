import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeTitle } from "./normalize";

interface Course {
  slug: string;
  name: string;
  department: string;
  level: string;
  duration: "FULL" | "HALF";
  credits: number;
  gradesOffered: number[];
  description: string;
  plannable: boolean;
  requirements: { kind: string; credits: number; provisional: boolean }[];
  interests: string[];
  prereqText: string | null;
}

const read = <T>(f: string) => JSON.parse(readFileSync(path.resolve("prisma/seed", f), "utf8")) as T;
const courses = read<Course[]>("courses.json");
const rules = read<{ kind: string; requiredCredits: number }[]>("requirements.json");
const tags = read<{ slug: string }[]>("interest-tags.json");
const aliases = read<{ alias: string; courseSlug: string }[]>("aliases.json");
const bySlug = new Map(courses.map((c) => [c.slug, c]));
const get = (slug: string) => {
  const c = bySlug.get(slug);
  if (!c) throw new Error(`missing course ${slug}`);
  return c;
};

describe("catalog seed integrity", () => {
  it("has a plausible number of courses", () => {
    expect(courses.length).toBeGreaterThan(150);
  });
  it("has unique slugs and names", () => {
    expect(bySlug.size).toBe(courses.length);
    expect(new Set(courses.map((c) => c.name)).size).toBe(courses.length);
  });
  it("slugs are url safe", () => {
    for (const c of courses) expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it("every plannable course has grades 9 to 12 and a description", () => {
    for (const c of courses.filter((c) => c.plannable)) {
      expect(c.gradesOffered.length, c.slug).toBeGreaterThan(0);
      expect(c.gradesOffered.every((g) => g >= 9 && g <= 12), c.slug).toBe(true);
      expect(c.description.length, c.slug).toBeGreaterThan(20);
    }
  });
  it("half-year courses are 2.5 credits and others are not", () => {
    for (const c of courses.filter((c) => c.plannable)) {
      if (c.duration === "HALF") expect(c.credits, c.slug).toBe(2.5);
    }
  });
  it("the known half-year courses are half-year", () => {
    for (const slug of [
      "financial-literacy", "principles-of-business", "marketing", "public-speaking", "sociology",
      "ap-microeconomics", "ap-macroeconomics", "constitutional-law", "religion-in-america",
      "critical-analysis-of-history-through-film", "one-world-one-community-world-problems-today",
      "astronomy", "earths-natural-disasters", "financial-investment", "management-and-leadership",
      "21st-century-life-skills",
    ]) {
      expect(get(slug).duration, slug).toBe("HALF");
    }
  });
  it("special credit cases", () => {
    expect(get("applied-physics-and-engineering").credits).toBe(10);
    expect(get("career-exploration-internship").credits).toBe(15);
  });
  it("middle school pseudo-courses are not plannable", () => {
    for (const slug of ["math-8", "algebra-i-8th-grade", "pre-algebra-8th-grade"]) {
      const c = get(slug);
      expect(c.level).toBe("MIDDLE_SCHOOL");
      expect(c.plannable).toBe(false);
    }
    expect(courses.filter((c) => c.level === "MIDDLE_SCHOOL" && c.plannable)).toHaveLength(0);
  });
  it("per-grade PE rows exist for 9 to 12", () => {
    const pe = courses.filter((c) => c.requirements.some((r) => r.kind === "PE_HEALTH"));
    expect(pe.map((c) => c.gradesOffered[0]).sort((a, b) => a - b)).toEqual([9, 10, 11, 12]);
  });
  it("American Studies counts toward English and Social Studies", () => {
    const kinds = get("american-studies").requirements.map((r) => r.kind).sort();
    expect(kinds).toEqual(["ENGLISH", "SOCIAL_STUDIES"]);
  });
  it("engineering physics courses satisfy the physics requirement", () => {
    for (const slug of ["applied-physics-and-engineering", "honors-engineering-design-ii"]) {
      expect(get(slug).requirements.some((r) => r.kind === "SCI_PHYS"), slug).toBe(true);
    }
  });
  it("AP Art History does not satisfy the arts requirement", () => {
    expect(get("ap-art-history").requirements.some((r) => r.kind === "ARTS")).toBe(false);
  });
  it("AP Capstone Research and journalism electives do not count as English", () => {
    for (const slug of ["ap-capstone-research", "21st-century-journalism-and-media", "creative-writing"]) {
      expect(get(slug).requirements.some((r) => r.kind === "ENGLISH"), slug).toBe(false);
    }
  });
  it("only the arts and life-careers tags are provisional, and all of those are", () => {
    for (const c of courses) {
      for (const r of c.requirements) {
        const shouldBeProvisional = r.kind === "ARTS" || r.kind === "LIFE_CAREERS";
        expect(r.provisional, `${c.slug} ${r.kind}`).toBe(shouldBeProvisional);
      }
    }
  });
  it("every requirement kind has a rule and every tag points at one", () => {
    const kinds = new Set(rules.map((r) => r.kind));
    expect(kinds.size).toBe(11);
    for (const c of courses) for (const r of c.requirements) expect(kinds.has(r.kind), `${c.slug} ${r.kind}`).toBe(true);
  });
  it("requirement thresholds match the PDF graduation table", () => {
    const need = Object.fromEntries(rules.map((r) => [r.kind, r.requiredCredits]));
    expect(need).toMatchObject({
      ENGLISH: 20, PE_HEALTH: 20, MATH: 15, SCI_BIO: 5, SCI_CHEM: 5, SCI_PHYS: 5,
      SOCIAL_STUDIES: 15, ARTS: 5, LIFE_CAREERS: 5, FIN_LIT: 2.5, WORLD_LANG: 10,
    });
  });
  it("every requirement kind can actually be met by some course", () => {
    const covered = new Set(courses.flatMap((c) => c.requirements.map((r) => r.kind)));
    for (const r of rules) expect(covered.has(r.kind), r.kind).toBe(true);
  });
  it("interest tags referenced by courses exist", () => {
    const known = new Set(tags.map((t) => t.slug));
    expect(known.size).toBe(11);
    for (const c of courses) for (const i of c.interests) expect(known.has(i), `${c.slug} ${i}`).toBe(true);
  });
  it("aliases point at real courses and are in normalized form", () => {
    const seen = new Set<string>();
    for (const a of aliases) {
      expect(bySlug.has(a.courseSlug), a.courseSlug).toBe(true);
      expect(a.alias).toBe(normalizeTitle(a.alias));
      expect(seen.has(a.alias), a.alias).toBe(false);
      seen.add(a.alias);
    }
  });
  it("the transcript titles from the spec resolve", () => {
    const names = new Map(courses.map((c) => [normalizeTitle(c.name), c.slug]));
    const alias = new Map(aliases.map((a) => [a.alias, a.courseSlug]));
    const resolve = (t: string) => alias.get(normalizeTitle(t)) ?? names.get(normalizeTitle(t));
    expect(resolve("Honors United States History I")).toBe("honors-u-s-history-i");
    expect(resolve("Physical Education/Health 9")).toBe("physical-education-health-9");
    expect(resolve("Physical Education/Driver Ed 10")).toBe("physical-education-driver-ed-10");
    expect(resolve("Physical Education/Health 11")).toBe("physical-education-health-11");
    expect(resolve("AP Computer Science A")).toBe("ap-computer-science-a");
    expect(resolve("Honors Biology")).toBe("honors-biology");
  });
  it("prerequisite text is verbatim-looking: never empty strings, no stray 'Grade' tails", () => {
    for (const c of courses) {
      if (c.prereqText === null) continue;
      expect(c.prereqText.trim().length, c.slug).toBeGreaterThan(3);
      expect(c.prereqText, c.slug).not.toMatch(/\bGrades?\s+\d+\s*$/);
    }
  });
  it("the dual enrollment partners from the spec are present", () => {
    const notes = courses.map((c) => c as unknown as { dualEnrollmentNote: string | null }).map((c) => c.dualEnrollmentNote ?? "");
    for (const partner of ["Seton Hall", "Kean", "William Paterson", "Syracuse", "Ramapo", "Texas"]) {
      expect(notes.some((n) => n.includes(partner)), partner).toBe(true);
    }
  });
});
