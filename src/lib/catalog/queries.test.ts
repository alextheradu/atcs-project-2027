import { describe, expect, it } from "vitest";
import { buildCourseWhere } from "./queries";

describe("buildCourseWhere", () => {
  it("hides archived and middle school courses by default", () => {
    expect(buildCourseWhere({})).toMatchObject({ archived: false, plannable: true });
  });
  it("includes archived when asked", () => {
    expect(buildCourseWhere({ includeArchived: true })).not.toHaveProperty("archived");
  });
  it("applies each filter", () => {
    const w = buildCourseWhere({ department: "MATH", level: "AP", duration: "HALF", grade: 11, interest: "coding-cs" });
    expect(w).toMatchObject({
      department: "MATH",
      level: "AP",
      duration: "HALF",
      gradesOffered: { has: 11 },
      interests: { some: { slug: "coding-cs" } },
    });
  });
  it("searches name and description case-insensitively", () => {
    const w = buildCourseWhere({ q: "calc" }) as { OR: unknown[] };
    expect(w.OR).toHaveLength(2);
    expect(JSON.stringify(w.OR)).toContain("insensitive");
  });
  it("ignores an empty query", () => {
    expect(buildCourseWhere({ q: "" })).not.toHaveProperty("OR");
  });
});
