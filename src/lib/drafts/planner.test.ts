import { describe, expect, it } from "vitest";
import { recoverPlanChange } from "./planner";

const entry = { id: "entry-1", courseId: "course-1", gradeLevel: 9, status: "PLANNED", grade: null, credits: 5 };
describe("interrupted plan changes", () => {
  it("does not replay an add that already reached the server", () => {
    expect(recoverPlanChange({ kind: "add", courseId: "course-1", gradeLevel: 9 }, [entry])).toBeNull();
  });
  it("does not silently move a course if another edit changed its year", () => {
    expect(recoverPlanChange({ kind: "add", courseId: "course-1", gradeLevel: 10 }, [entry])).toEqual({ conflict: true });
  });
  it("recognizes acknowledged moves, updates and removals", () => {
    expect(recoverPlanChange({ kind: "move", courseId: "course-1", gradeLevel: 9 }, [entry])).toBeNull();
    expect(recoverPlanChange({ kind: "update", courseId: "course-1", patch: { credits: 5 } }, [entry])).toBeNull();
    expect(recoverPlanChange({ kind: "remove", courseId: "course-1" }, [])).toBeNull();
  });
  it("uses the current entry id, and never recreates a deleted entry for an update", () => {
    expect(recoverPlanChange({ kind: "move", courseId: "course-1", gradeLevel: 10 }, [entry])).toEqual({ kind: "move", entryId: "entry-1", gradeLevel: 10 });
    expect(recoverPlanChange({ kind: "update", courseId: "course-1", patch: { credits: 6 } }, [])).toEqual({ conflict: true });
  });
  it("rejects malformed recovery commands", () => {
    expect(recoverPlanChange({ kind: "remove", entryId: "someone-else" }, [entry])).toEqual({ conflict: true });
  });
});
