import { describe, expect, it } from "vitest";
import { normalizeTitle } from "./normalize";

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTitle("AP Computer Science A")).toBe("ap computer science a");
    expect(normalizeTitle("Geometry (Enhanced)")).toBe("geometry enhanced");
  });
  it("expands common transcript abbreviations", () => {
    expect(normalizeTitle("Hon English I")).toBe("honors english i");
    expect(normalizeTitle("Hon. Eng II")).toBe("honors english ii");
    expect(normalizeTitle("Eng III")).toBe("english iii");
  });
  it("treats ampersands as and", () => {
    expect(normalizeTitle("Applied Physics & Engineering")).toBe("applied physics and engineering");
  });
  it("unifies United States, U.S. and US", () => {
    const want = "honors us history i";
    expect(normalizeTitle("Honors United States History I")).toBe(want);
    expect(normalizeTitle("Honors U.S. History I")).toBe(want);
    expect(normalizeTitle("Honors U. S. History I")).toBe(want);
    expect(normalizeTitle("Honors US History I")).toBe(want);
  });
  it("maps Advanced Placement to AP", () => {
    expect(normalizeTitle("Advanced Placement Calculus BC")).toBe("ap calculus bc");
  });
  it("collapses whitespace and slashes", () => {
    expect(normalizeTitle("  Physical Education/Health   9 ")).toBe("physical education health 9");
  });
  it("keeps roman numerals and digits", () => {
    expect(normalizeTitle("Spanish IV")).toBe("spanish iv");
    expect(normalizeTitle("21st Century Life Skills")).toBe("21st century life skills");
  });
  it("does not expand hon inside other words", () => {
    expect(normalizeTitle("Honda Engineering")).toBe("honda engineering");
    expect(normalizeTitle("Engineering Design")).toBe("engineering design");
  });
});
