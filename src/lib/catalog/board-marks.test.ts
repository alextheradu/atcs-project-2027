import { describe, expect, it } from "vitest";
import { boardMarks, openGroups } from "./board-marks";

describe("boardMarks", () => {
  it("labels each class on the board by its status", () => {
    const marks = boardMarks([
      { courseId: "a", status: "COMPLETED", gradeLevel: 9 },
      { courseId: "b", status: "IN_PROGRESS", gradeLevel: 10 },
      { courseId: "c", status: "PLANNED", gradeLevel: 11 },
      { courseId: "d", status: "PLANNED", gradeLevel: 12 },
    ]);
    expect(marks.get("a")).toBe("Done");
    expect(marks.get("b")).toBe("Taking now");
    expect(marks.get("c")).toBe("On your board, 11th");
    expect(marks.get("d")).toBe("On your board, 12th");
    expect(marks.get("z")).toBeUndefined();
  });
  it("is empty without a board", () => {
    expect(boardMarks([]).size).toBe(0);
  });
});

describe("openGroups", () => {
  const groups: [string, { id: string }[]][] = [
    ["MATH", [{ id: "m1" }, { id: "m2" }]],
    ["ENGLISH", [{ id: "e1" }]],
    ["ART", [{ id: "a1" }]],
  ];
  it("opens every group when the rule says open all", () => {
    expect(openGroups(groups, new Set(), true)).toEqual(new Set(["MATH", "ENGLISH", "ART"]));
  });
  it("opens nothing when closed and nothing is on the board", () => {
    expect(openGroups(groups, new Set(), false).size).toBe(0);
  });
  it("opens the groups that hold a class on the board", () => {
    expect(openGroups(groups, new Set(["m2", "a1", "not-shown"]), false)).toEqual(new Set(["MATH", "ART"]));
  });
});
