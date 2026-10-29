import { describe, expect, it } from "vitest";
import { createMatcher, bandFor, matchKey, type CatalogCourse } from "./match";

const cat = (id: string, name: string, archived = false): CatalogCourse => ({ id, name, archived });
const catalog = [
  cat("eng1", "English I"), cat("heng3", "Honors English III"), cat("eng3", "English III"),
  cat("bio", "Biology"), cat("hbio", "Honors Biology"), cat("ush1", "U.S. History I"), cat("hush1", "Honors U.S. History I"),
  cat("apcs", "AP Computer Science A"), cat("atcs", "Advanced Topics in Computer Science (Honors)"),
  cat("pe9", "Physical Education/Health 9"), cat("alg2te", "Algebra II with Trigonometry Enhanced"),
  cat("old", "Old Course", true), cat("wh", "World History"), cat("twh", "Themes in World History"),
];
const match = createMatcher(catalog, [{ alias: "physical education health nine", courseId: "pe9" }]);

describe("matching order", () => {
  it("an alias wins over everything", () => {
    const r = match("Physical Education Health Nine");
    expect(r).toMatchObject({ courseId: "pe9", via: "alias", band: "exact", confidence: 1 });
  });
  it("exact catalog names match after normalizing", () => {
    expect(match("English I")).toMatchObject({ courseId: "eng1", via: "name", band: "exact" });
    expect(match("Hon Eng III")).toMatchObject({ courseId: "heng3", via: "name" });
    expect(match("Honors United States History I")).toMatchObject({ courseId: "hush1", via: "name" });
    expect(match("Physical Education/Health 9")).toMatchObject({ courseId: "pe9", via: "name" });
    expect(match("Advanced Topics in Computer Science (H)")).toMatchObject({ courseId: "atcs", via: "name" });
  });
  it("a title that ends in a letter is still the right course", () => {
    expect(match("AP Computer Science A")).toMatchObject({ courseId: "apcs", band: "exact" });
  });
  it("an alias to a missing course is ignored", () => {
    const m = createMatcher(catalog, [{ alias: "english i", courseId: "gone" }]);
    expect(m("English I").courseId).toBe("eng1");
  });
});

describe("level and number guards", () => {
  it("never turns Honors Biology into Biology on a fuzzy hit", () => {
    const m = createMatcher([cat("bio", "Biology")], []);
    const r = m("Honors Biology");
    expect(r.courseId === null || r.confidence <= 0.5).toBe(true);
    expect(r.band === "none" || r.band === "check").toBe(true);
  });
  it("caps a number mismatch", () => {
    const m = createMatcher([cat("eng3", "English III")], []);
    const r = m("English II");
    expect(r.confidence).toBeLessThanOrEqual(0.5);
    expect(r.courseId).toBeNull();
  });
  it("does not confuse World History with Themes in World History", () => {
    expect(match("World History")).toMatchObject({ courseId: "wh", band: "exact" });
  });
});

describe("fuzzy matching", () => {
  it("catches a small typo and flags it for a quick look", () => {
    const r = match("Algebra II with Trigonmetry Enhanced");
    expect(r).toMatchObject({ courseId: "alg2te", via: "fuzzy" });
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
    expect(["good", "check"]).toContain(r.band);
  });
  it("selects nothing for a title it does not know, and still offers candidates", () => {
    const r = match("Underwater Basket Weaving");
    expect(r).toMatchObject({ courseId: null, via: "none", band: "none" });
  });
  it("returns candidates for the fix dropdown, best first", () => {
    const r = match("English");
    expect(r.candidates.length).toBeGreaterThan(0);
    for (let i = 1; i < r.candidates.length; i++) expect(r.candidates[i - 1].confidence).toBeGreaterThanOrEqual(r.candidates[i].confidence);
  });
  it("an archived course can match when nothing live shares the name", () => {
    expect(match("Old Course")).toMatchObject({ courseId: "old", band: "exact" });
  });
});

describe("bands and keys", () => {
  it("documents the thresholds", () => {
    expect(bandFor(1, true)).toBe("exact");
    expect(bandFor(0.8, false)).toBe("good");
    expect(bandFor(0.79, false)).toBe("check");
    expect(bandFor(0.55, false)).toBe("check");
    expect(bandFor(0.54, false)).toBe("none");
  });
  it("turns (H) into honors and leaves other trailing letters alone", () => {
    expect(matchKey("Advanced Topics in Computer Science (H)")).toBe("advanced topics in computer science honors");
    expect(matchKey("AP Computer Science A")).toBe("ap computer science a");
  });
});
