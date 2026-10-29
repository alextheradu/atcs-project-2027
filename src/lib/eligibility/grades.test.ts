import { describe, expect, it } from "vitest";
import { GRADES, gradeAtLeast, gradeRank, gradeText, isPassing, type Grade } from "./grades";

describe("grade order", () => {
  it("runs from F up to A+ with no gaps", () => {
    expect(GRADES[0]).toBe("F");
    expect(GRADES[GRADES.length - 1]).toBe("A_PLUS");
    expect(GRADES.map((g) => gradeRank(g))).toEqual(GRADES.map((_, i) => i));
  });

  it("meets a threshold at the boundary and not one step below, for every grade", () => {
    for (let i = 0; i < GRADES.length; i++) {
      const need = GRADES[i];
      expect(gradeAtLeast(need, need)).toBe(true);
      if (i > 0) expect(gradeAtLeast(GRADES[i - 1], need)).toBe(false);
      if (i < GRADES.length - 1) expect(gradeAtLeast(GRADES[i + 1], need)).toBe(true);
    }
  });

  it("puts the letter families in the usual order", () => {
    const order: Grade[] = ["B_MINUS", "B", "B_PLUS", "A_MINUS", "A", "A_PLUS"];
    for (let i = 1; i < order.length; i++) expect(gradeAtLeast(order[i], order[i - 1])).toBe(true);
    expect(gradeAtLeast("B_PLUS", "A_MINUS")).toBe(false);
    expect(gradeAtLeast("C_MINUS", "D_PLUS")).toBe(true);
  });

  it("cannot compare PASS", () => {
    expect(gradeRank("PASS")).toBeNull();
    expect(gradeAtLeast("PASS", "C")).toBeNull();
    expect(gradeAtLeast("A", "PASS")).toBeNull();
  });

  it("treats everything above F as passing, including PASS", () => {
    expect(isPassing("F")).toBe(false);
    expect(isPassing("D")).toBe(true);
    expect(isPassing("PASS")).toBe(true);
  });

  it("prints readable labels", () => {
    expect(gradeText("B_PLUS")).toBe("B+");
    expect(gradeText("A_MINUS")).toBe("A-");
    expect(gradeText("PASS")).toBe("Pass");
  });
});
