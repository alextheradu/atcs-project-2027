import { describe, expect, it } from "vitest";
import { canTakeAnswer } from "./answer";
import type { Eligibility, EvalResult } from "./types";
import type { GradeFit } from "./course-fit";

const fit = (grade: number, status: Eligibility, summary = `summary ${grade}`, viaAppeal = false, notes: string[] = []): GradeFit => ({
  grade,
  result: { status, viaAppeal, summary, tree: null, leaves: [], unmet: [], notes } as EvalResult,
});

describe("canTakeAnswer", () => {
  it("has nothing to say when the class has no checks", () => {
    expect(canTakeAnswer([], { approved: false })).toBeNull();
  });
  it("names the grades a student qualifies for", () => {
    const a = canTakeAnswer([fit(10, "NOT_ELIGIBLE_LOCKED"), fit(11, "ELIGIBLE"), fit(12, "ELIGIBLE")], { approved: false });
    expect(a).toEqual({ tone: "eligible", text: "You can take this in 11th or 12th grade." });
  });
  it("lists three or more grades with commas", () => {
    const a = canTakeAnswer([fit(9, "ELIGIBLE"), fit(10, "ELIGIBLE"), fit(11, "ELIGIBLE")], { approved: false });
    expect(a?.text).toBe("You can take this in 9th, 10th or 11th grade.");
  });
  it("says to check the details when only a warning stands in the way", () => {
    const a = canTakeAnswer([fit(11, "ELIGIBLE_WITH_WARNING", "Add your 8th grade math.")], { approved: false });
    expect(a).toEqual({ tone: "warning", text: "You can take this in 11th grade, but check the details first.", detail: "Add your 8th grade math." });
  });
  it("points to a placement review when that is the way in", () => {
    const a = canTakeAnswer([fit(11, "NOT_ELIGIBLE_LOCKED"), fit(12, "NOT_ELIGIBLE_APPEALABLE", "Needs a B+ in Chemistry.")], { approved: false });
    expect(a).toEqual({ tone: "appeal", text: "You need a placement review to take this.", detail: "Needs a B+ in Chemistry." });
  });
  it("says plainly when the class is out of reach for now", () => {
    const a = canTakeAnswer([fit(11, "NOT_ELIGIBLE_LOCKED", "Needs Precalculus first.")], { approved: false });
    expect(a).toEqual({ tone: "locked", text: "You can't take this yet.", detail: "Needs Precalculus first." });
  });
  it("never offers a grade the student has already finished", () => {
    const fits = [fit(9, "ELIGIBLE"), fit(10, "ELIGIBLE"), fit(11, "ELIGIBLE"), fit(12, "ELIGIBLE")];
    expect(canTakeAnswer(fits, { approved: false, currentGrade: 11 })?.text).toBe("You can take this in 11th or 12th grade.");
  });
  it("judges only the grades still ahead", () => {
    const fits = [fit(10, "ELIGIBLE"), fit(11, "NOT_ELIGIBLE_LOCKED", "Needs Precalculus first.")];
    expect(canTakeAnswer(fits, { approved: false, currentGrade: 11 })).toEqual({ tone: "locked", text: "You can't take this yet.", detail: "Needs Precalculus first." });
  });
  it("says so when every grade it is offered in is behind the student", () => {
    expect(canTakeAnswer([fit(9, "ELIGIBLE"), fit(10, "ELIGIBLE")], { approved: false, currentGrade: 12 })).toEqual({
      tone: "locked", text: "This class is offered in grades you have already finished.",
    });
  });
  it("says what a person still decides as a note, not a warning", () => {
    const a = canTakeAnswer([fit(11, "ELIGIBLE", "Teacher recommendation", false, ["Teacher recommendation"])], { approved: false });
    expect(a).toEqual({ tone: "eligible", text: "You can take this in 11th grade.", note: "Teacher recommendation" });
  });
  it("says the student took it instead of judging it again", () => {
    expect(canTakeAnswer([fit(9, "ELIGIBLE_WITH_WARNING")], { approved: false, taken: "COMPLETED" })).toEqual({ tone: "eligible", text: "You took this class." });
    expect(canTakeAnswer([fit(9, "NOT_ELIGIBLE_LOCKED")], { approved: false, taken: "IN_PROGRESS" })).toEqual({ tone: "eligible", text: "You are taking this class now." });
  });
  it("judges the grade the class is planned in", () => {
    const fits = [fit(10, "NOT_ELIGIBLE_APPEALABLE", "Take Algebra II in grade 10 too."), fit(11, "NOT_ELIGIBLE_APPEALABLE", "Take Algebra II in grade 11 too."), fit(12, "ELIGIBLE")];
    expect(canTakeAnswer(fits, { approved: false, plannedGrade: 11 })).toEqual({
      tone: "appeal", text: "In 11th grade, where it is on your board, you need a placement review.", detail: "Take Algebra II in grade 11 too.",
    });
    expect(canTakeAnswer(fits, { approved: false, plannedGrade: 12 })).toEqual({ tone: "eligible", text: "You can take this in 12th grade, where it is on your board." });
  });
  it("treats a missing partner class as something to add, the same as the Board tile", () => {
    const coreq = { grade: 11, result: { status: "NOT_ELIGIBLE_APPEALABLE", viaAppeal: false, summary: "Take Algebra II in grade 11 too.", tree: null, leaves: [], notes: [],
      unmet: [{ rule: { type: "coreq", courses: ["algebra-ii"] }, state: "unmet", appealable: true, message: "Take Algebra II in grade 11 too." }] } as unknown as EvalResult };
    expect(canTakeAnswer([coreq], { approved: false, plannedGrade: 11 })).toEqual({
      tone: "warning", text: "To take this in 11th grade, where it is on your board, add its partner class.", detail: "Take Algebra II in grade 11 too.",
    });
  });
  it("counts an approved review as a yes", () => {
    expect(canTakeAnswer([fit(11, "NOT_ELIGIBLE_APPEALABLE")], { approved: true })).toEqual({
      tone: "eligible", text: "Your placement review was approved, so you can take this.",
    });
  });
});
