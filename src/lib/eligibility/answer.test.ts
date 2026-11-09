import { describe, expect, it } from "vitest";
import { canTakeAnswer } from "./answer";
import type { Eligibility, EvalResult } from "./types";
import type { GradeFit } from "./course-fit";

const fit = (grade: number, status: Eligibility, summary = `summary ${grade}`, viaAppeal = false): GradeFit => ({
  grade,
  result: { status, viaAppeal, summary, tree: null, leaves: [], unmet: [] } as EvalResult,
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
  it("counts an approved review as a yes", () => {
    expect(canTakeAnswer([fit(11, "NOT_ELIGIBLE_APPEALABLE")], { approved: true })).toEqual({
      tone: "eligible", text: "Your placement review was approved, so you can take this.",
    });
  });
});
