import { describe, expect, it } from "vitest";
import { DEFAULT_GUIDANCE, guidanceFor, parseGuidance } from "./index";

const e = (department: string, gradeLevel: number) => ({ department, gradeLevel });
const full = [e("ENGLISH", 9), e("ENGLISH", 10), e("ENGLISH", 11), e("ENGLISH", 12), e("MATH", 9), e("MATH", 10), e("MATH", 11), e("SCIENCE", 9), e("SCIENCE", 10), e("SCIENCE", 11), e("SOCIAL_STUDIES", 9), e("SOCIAL_STUDIES", 10), e("SOCIAL_STUDIES", 11), e("WORLD_LANGUAGE", 9), e("WORLD_LANGUAGE", 10)];
const line = (r: ReturnType<typeof guidanceFor>, s: string) => r.lines.find((l) => l.subject === s)!;

describe("guidanceFor", () => {
  it("meets the base recommendation with 4 English, 3 math, 3 science, 3 social studies, 2 language", () => {
    const r = guidanceFor(DEFAULT_GUIDANCE, "", full);
    expect(r.lines.every((l) => l.met)).toBe(true);
    expect(r.matched).toEqual([]);
  });
  it("counts years, not courses", () => {
    const r = guidanceFor(DEFAULT_GUIDANCE, "", [e("MATH", 9), e("MATH", 9), e("MATH", 10)]);
    expect(line(r, "MATH")).toMatchObject({ have: 2, need: 3, met: false });
  });
  it("raises math to 4 for an engineering major and science to 4 for a nursing major", () => {
    expect(line(guidanceFor(DEFAULT_GUIDANCE, "Mechanical engineering", full), "MATH").need).toBe(4);
    expect(line(guidanceFor(DEFAULT_GUIDANCE, "Mechanical engineering", full), "SCIENCE").need).toBe(4);
    const nurse = guidanceFor(DEFAULT_GUIDANCE, "nursing", full);
    expect(line(nurse, "SCIENCE")).toMatchObject({ need: 4, met: false });
    expect(line(nurse, "MATH").need).toBe(3);
    expect(nurse.matched).toEqual(["Science, health care and engineering"]);
  });
  it("matches whole words, so history does not match a science keyword", () => {
    expect(guidanceFor(DEFAULT_GUIDANCE, "history", full).matched).toEqual([]);
  });
  it("ignores an unknown or empty major", () => {
    expect(guidanceFor(DEFAULT_GUIDANCE, null, full).matched).toEqual([]);
    expect(guidanceFor(DEFAULT_GUIDANCE, "undecided", full).matched).toEqual([]);
  });
});

describe("parseGuidance", () => {
  it("falls back to the defaults for bad data", () => {
    expect(parseGuidance({ base: "x" })).toBe(DEFAULT_GUIDANCE);
    expect(parseGuidance(null)).toBe(DEFAULT_GUIDANCE);
    expect(parseGuidance({ ...DEFAULT_GUIDANCE, base: { ...DEFAULT_GUIDANCE.base, MATH: 9 } })).toBe(DEFAULT_GUIDANCE);
  });
  it("accepts the defaults", () => {
    expect(parseGuidance(DEFAULT_GUIDANCE)).toEqual(DEFAULT_GUIDANCE);
  });
});
