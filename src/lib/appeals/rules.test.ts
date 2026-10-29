import { describe, expect, it } from "vitest";
import { canReview, canTransition, canView, checkWindow, isDecidable, isEditable, isWithdrawable, snapshotUnmet, type AppealStatus, type WindowEvent } from "./rules";

const ALL: AppealStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "WITHDRAWN"];

describe("status machine", () => {
  it("only moves forward", () => {
    expect(canTransition("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("SUBMITTED", "DENIED")).toBe(true);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("DRAFT", "WITHDRAWN")).toBe(false);
  });
  it("decisions are final", () => {
    for (const done of ["APPROVED", "DENIED", "WITHDRAWN"] as const) for (const to of ALL) expect(canTransition(done, to)).toBe(false);
  });
  it("withdraw is possible only between submitting and a decision", () => {
    expect(ALL.filter(isWithdrawable)).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
    expect(ALL.filter(isDecidable)).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
    expect(ALL.filter(isEditable)).toEqual(["DRAFT"]);
  });
});

describe("windows", () => {
  const d = (s: string) => new Date(s);
  const win = (audience: WindowEvent["audience"], opens: string, closes: string | null, kind = "APPEAL_WINDOW"): WindowEvent => ({ id: opens, kind, audience, label: "w", opensAt: d(opens), closesAt: closes ? d(closes) : null });
  const now = d("2027-02-15T12:00:00Z");

  it("current students can always submit", () => {
    expect(checkWindow("STUDENT", [], now).allowed).toBe(true);
  });
  it("incoming students need an open window for their audience", () => {
    expect(checkWindow("INCOMING", [], now).allowed).toBe(false);
    expect(checkWindow("INCOMING", [win("INCOMING", "2027-02-09T00:00:00Z", "2027-03-27T00:00:00Z")], now)).toMatchObject({ allowed: true });
    expect(checkWindow("INCOMING", [win("ALL", "2027-02-09T00:00:00Z", "2027-03-27T00:00:00Z")], now).allowed).toBe(true);
  });
  it("a window for current students does not open the door for incoming ones", () => {
    expect(checkWindow("INCOMING", [win("CURRENT", "2027-02-09T00:00:00Z", "2027-03-27T00:00:00Z")], now).allowed).toBe(false);
  });
  it("ignores other event kinds", () => {
    expect(checkWindow("INCOMING", [win("INCOMING", "2027-02-09T00:00:00Z", "2027-03-27T00:00:00Z", "COURSE_SELECTION")], now).allowed).toBe(false);
  });
  it("is closed before it opens and after it closes, and reports the next open date", () => {
    const w = [win("INCOMING", "2027-03-01T00:00:00Z", "2027-03-27T00:00:00Z"), win("INCOMING", "2027-01-01T00:00:00Z", "2027-02-01T00:00:00Z"), win("INCOMING", "2027-09-01T00:00:00Z", null)];
    const r = checkWindow("INCOMING", w, now);
    expect(r.allowed).toBe(false);
    expect(r.nextOpen?.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });
  it("includes both edges, and an open ended window stays open", () => {
    const w = win("INCOMING", "2027-02-15T12:00:00Z", "2027-02-15T12:00:00Z");
    expect(checkWindow("INCOMING", [w], now).allowed).toBe(true);
    expect(checkWindow("INCOMING", [win("INCOMING", "2027-01-01T00:00:00Z", null)], now).allowed).toBe(true);
  });
  it("has no next date when nothing is scheduled", () => {
    expect(checkWindow("INCOMING", [], now).nextOpen).toBeNull();
  });
});

describe("reviewer scope", () => {
  const sup = { id: "s", role: "SUPERVISOR", departments: ["MATH"] };
  it("supervisors decide only their departments, admins any", () => {
    expect(canReview(sup, "MATH")).toBe(true);
    expect(canReview(sup, "SCIENCE")).toBe(false);
    expect(canReview({ id: "a", role: "ADMIN", departments: [] }, "ART")).toBe(true);
  });
  it("students, incoming students and counselors never decide", () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR"]) expect(canReview({ id: "x", role, departments: ["MATH"] }, "MATH")).toBe(false);
  });
  it("a student reads only their own appeal", () => {
    const appeal = { studentId: "u1", department: "MATH" };
    expect(canView({ id: "u1", role: "STUDENT", departments: [] }, appeal)).toBe(true);
    expect(canView({ id: "u2", role: "STUDENT", departments: [] }, appeal)).toBe(false);
    expect(canView(sup, appeal)).toBe(true);
    expect(canView({ ...sup, departments: ["ART"] }, appeal)).toBe(false);
  });
});

describe("snapshotUnmet", () => {
  it("keeps the type and a trimmed message, at most twelve", () => {
    const leaves = Array.from({ length: 20 }, (_, i) => ({ rule: { type: "minGrade" }, message: `m${i}${"x".repeat(400)}` }));
    const out = snapshotUnmet(leaves);
    expect(out).toHaveLength(12);
    expect(out[0].message.length).toBe(300);
  });
});
