import { describe, expect, it } from "vitest";
import { canComment, canEditPlan, canReviewPlans, canTransition, commentAudience, isReadOnly, isReviewable, type PlanStatus } from "./index";

const ALL: PlanStatus[] = ["DRAFT", "SUBMITTED", "CHANGES_REQUESTED", "APPROVED"];

describe("plan status machine", () => {
  it("follows the review flow", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransition("SUBMITTED", "CHANGES_REQUESTED")).toBe(true);
    expect(canTransition("CHANGES_REQUESTED", "SUBMITTED")).toBe(true);
    expect(canTransition("APPROVED", "DRAFT")).toBe(true);
  });
  it("cannot skip review or decide a draft", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("DRAFT", "CHANGES_REQUESTED")).toBe(false);
    expect(canTransition("APPROVED", "CHANGES_REQUESTED")).toBe(false);
    expect(canTransition("APPROVED", "SUBMITTED")).toBe(false);
  });
  it("only a submitted plan can be reviewed", () => {
    expect(ALL.filter(isReviewable)).toEqual(["SUBMITTED"]);
  });
  it("submitted and approved plans are read-only, changes requested is editable", () => {
    expect(ALL.filter(isReadOnly)).toEqual(["SUBMITTED", "APPROVED"]);
  });
});

describe("who can do what", () => {
  const owner = { id: "o", role: "STUDENT" };
  it("only counselors and admins review plans", () => {
    expect(canReviewPlans({ id: "c", role: "COUNSELOR" })).toBe(true);
    expect(canReviewPlans({ id: "a", role: "ADMIN" })).toBe(true);
    for (const role of ["STUDENT", "INCOMING", "SUPERVISOR"]) expect(canReviewPlans({ id: "x", role })).toBe(false);
  });
  it("the owner and reviewers comment, other students do not", () => {
    expect(canComment(owner, "o")).toBe(true);
    expect(canComment({ id: "c", role: "COUNSELOR" }, "o")).toBe(true);
    expect(canComment({ id: "z", role: "STUDENT" }, "o")).toBe(false);
    expect(canComment({ id: "s", role: "SUPERVISOR" }, "o")).toBe(false);
  });
  it("a counselor or admin never edits a student's plan", () => {
    expect(canEditPlan(owner, "o", "DRAFT")).toBe(true);
    expect(canEditPlan(owner, "o", "CHANGES_REQUESTED")).toBe(true);
    expect(canEditPlan(owner, "o", "SUBMITTED")).toBe(false);
    expect(canEditPlan({ id: "c", role: "COUNSELOR" }, "o", "DRAFT")).toBe(false);
    expect(canEditPlan({ id: "a", role: "ADMIN" }, "o", "DRAFT")).toBe(false);
  });
  it("comments notify the other side", () => {
    expect(commentAudience(owner, "o")).toBe("reviewers");
    expect(commentAudience({ id: "c", role: "COUNSELOR" }, "o")).toBe("owner");
  });
});
