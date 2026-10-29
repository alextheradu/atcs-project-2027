import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", async () => {
  const g = await import("@/lib/auth/guards");
  return {
    requireUser: async () => { if (!state.user) throw new g.UnauthenticatedError(); return state.user; },
    requireRole: async (...roles: string[]) => g.assertRole(state.user as never, roles as never),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("./fit", () => ({ bestFitOf: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() });
  const db = { appeal: m(), appealAnswer: m(), appealQuestion: m(), timelineEvent: m(), course: m(), planEntry: m(), user: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { notify } from "@/lib/notify";
import * as actions from "./actions";
import { bestFitOf } from "./fit";

let n = 0;
const make = (role: string, departments: string[] = [], id?: string) => ({ id: id ?? `u${++n}`, role, departments, email: "x@y.org", name: null });
const appeal = (more = {}) => ({ id: "a1", studentId: "stu", status: "DRAFT", department: "MATH", targetCourseId: "c1", answers: [], targetCourse: { name: "Calculus" }, ...more });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("STUDENT", [], "stu");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.appeal.findFirst.mockResolvedValue(appeal());
  fakeDb.appeal.findUnique.mockResolvedValue(appeal({ status: "SUBMITTED" }));
  fakeDb.timelineEvent.findMany.mockResolvedValue([]);
  fakeDb.appealQuestion.findMany.mockResolvedValue([]);
  fakeDb.user.findMany.mockResolvedValue([{ id: "sup" }]);
});

describe("students and their own appeals", () => {
  it("admins can save, submit, withdraw and delete their own requests", async () => {
    state.user = make("ADMIN", [], "admin");
    expect((await actions.saveDraft({ appealId: "a1", answers: [] })).ok).toBe(true);
    expect((await actions.submitAppeal("a1")).ok).toBe(true);
    fakeDb.appeal.findFirst.mockResolvedValue(appeal({ status: "SUBMITTED" }));
    expect((await actions.withdrawAppeal("a1")).ok).toBe(true);
    fakeDb.appeal.findFirst.mockResolvedValue(appeal());
    expect((await actions.deleteDraft("a1")).ok).toBe(true);
    for (const [query] of fakeDb.appeal.findFirst.mock.calls) expect(query.where.studentId).toBe("admin");
  });

  it("admins cannot use student actions on another student's request", async () => {
    state.user = make("ADMIN", [], "admin");
    fakeDb.appeal.findFirst.mockResolvedValue(null);
    for (const result of [await actions.saveDraft({ appealId: "a1", answers: [] }), await actions.submitAppeal("a1"), await actions.withdrawAppeal("a1"), await actions.deleteDraft("a1")]) {
      expect(result).toEqual({ ok: false, error: "Appeal not found." });
    }
    for (const [query] of fakeDb.appeal.findFirst.mock.calls) expect(query.where.studentId).toBe("admin");
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
    expect(fakeDb.appeal.delete).not.toHaveBeenCalled();
  });
  it("another student's appeal is not found, for every student action", async () => {
    fakeDb.appeal.findFirst.mockResolvedValue(null);
    for (const r of [await actions.saveDraft({ appealId: "a1", answers: [] }), await actions.submitAppeal("a1"), await actions.withdrawAppeal("a1"), await actions.deleteDraft("a1")]) {
      expect(r).toEqual({ ok: false, error: "Appeal not found." });
    }
    for (const call of [...fakeDb.appeal.findFirst.mock.calls]) expect(call[0].where).toMatchObject({ studentId: "stu" });
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
    expect(fakeDb.appeal.delete).not.toHaveBeenCalled();
  });

  it("staff cannot use the student actions", async () => {
    state.user = make("SUPERVISOR", ["MATH"]);
    expect(await actions.submitAppeal("a1")).toMatchObject({ ok: false });
    expect(await actions.startAppeal("calculus")).toMatchObject({ ok: false });
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
  });

  it("needs a signed in user", async () => {
    state.user = null;
    await expect(actions.submitAppeal("a1")).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("a submitted request cannot be edited or deleted", async () => {
    fakeDb.appeal.findFirst.mockResolvedValue(appeal({ status: "SUBMITTED" }));
    expect((await actions.saveDraft({ appealId: "a1", answers: [] })).ok).toBe(false);
    expect((await actions.deleteDraft("a1")).ok).toBe(false);
  });

  it("only a submitted request can be withdrawn", async () => {
    expect((await actions.withdrawAppeal("a1")).ok).toBe(false);
    fakeDb.appeal.findFirst.mockResolvedValue(appeal({ status: "SUBMITTED" }));
    expect((await actions.withdrawAppeal("a1")).ok).toBe(true);
    fakeDb.appeal.findFirst.mockResolvedValue(appeal({ status: "APPROVED" }));
    expect((await actions.withdrawAppeal("a1")).ok).toBe(false);
  });

  it("rejects oversized answers", async () => {
    expect((await actions.saveDraft({ appealId: "a1", answers: [{ questionId: "q", answer: "x".repeat(2001) }] })).ok).toBe(false);
    expect((await actions.saveDraft({ appealId: "a1", reportedAverage: 140, answers: [] })).ok).toBe(false);
  });

  it("copies the question prompt into the answer", async () => {
    fakeDb.appealQuestion.findMany.mockResolvedValue([{ id: "q1", prompt: "Why do you want this course?" }]);
    await actions.saveDraft({ appealId: "a1", answers: [{ questionId: "q1", answer: "Because" }, { questionId: "unknown", answer: "x" }] });
    expect(fakeDb.appealAnswer.createMany).toHaveBeenCalledWith({ data: [{ appealId: "a1", questionId: "q1", prompt: "Why do you want this course?", answer: "Because" }] });
  });
});

describe("windows", () => {
  const w = (opens: string, closes: string) => ({ id: "w1", kind: "APPEAL_WINDOW", audience: "INCOMING", label: "x", opensAt: new Date(opens), closesAt: new Date(closes) });

  it("an incoming student cannot submit outside a window, but the draft is kept", async () => {
    state.user = make("INCOMING", [], "stu");
    fakeDb.timelineEvent.findMany.mockResolvedValue([w("2999-01-01T00:00:00Z", "2999-02-01T00:00:00Z")]);
    const r = await actions.submitAppeal("a1");
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("Your draft is saved");
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
    expect((await actions.saveDraft({ appealId: "a1", answers: [] })).ok).toBe(true);
  });

  it("an incoming student can submit inside a window", async () => {
    state.user = make("INCOMING", [], "stu");
    fakeDb.timelineEvent.findMany.mockResolvedValue([w("2000-01-01T00:00:00Z", "2999-02-01T00:00:00Z")]);
    expect((await actions.submitAppeal("a1")).ok).toBe(true);
    expect(fakeDb.appeal.update.mock.calls[0][0].data).toMatchObject({ status: "SUBMITTED", windowId: "w1" });
  });

  it("a current student can submit at any time, and supervisors of that department are told", async () => {
    expect((await actions.submitAppeal("a1")).ok).toBe(true);
    expect(fakeDb.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { role: "SUPERVISOR", departments: { has: "MATH" } } }));
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "sup", kind: "APPEAL_SUBMITTED" })]);
  });

  it("falls back to admins when no supervisor has the department", async () => {
    fakeDb.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "adm" }]);
    await actions.submitAppeal("a1");
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "adm" })]);
  });

  it("will not send until required questions are answered", async () => {
    fakeDb.appealQuestion.findMany.mockResolvedValue([{ id: "q1" }]);
    expect((await actions.submitAppeal("a1")).ok).toBe(false);
    fakeDb.appeal.findFirst.mockResolvedValue(appeal({ answers: [{ questionId: "q1" }] }));
    expect((await actions.submitAppeal("a1")).ok).toBe(true);
  });

  it("is rate limited", async () => {
    state.user = make("STUDENT", [], "limited");
    for (let i = 0; i < 10; i++) await actions.submitAppeal("a1");
    expect(await actions.submitAppeal("a1")).toMatchObject({ ok: false, error: expect.stringContaining("too quickly") });
  });
});

describe("starting a request", () => {
  const course = { id: "c1", slug: "calculus", archived: false, plannable: true, department: "MATH", gradesOffered: [11], rules: null, prereqText: "x" };
  beforeEach(() => {
    fakeDb.course.findUnique.mockResolvedValue(course);
    fakeDb.appeal.findFirst.mockResolvedValue(null);
    fakeDb.appeal.create.mockResolvedValue({ id: "new" });
  });
  const fit = (status: string) => vi.mocked(bestFitOf).mockResolvedValue({ status, unmet: [{ rule: { type: "minGrade" }, message: "Needs B-", state: "unmet" }], leaves: [] } as never);

  it("admins start requests against their own eligibility with current-student rules", async () => {
    state.user = make("ADMIN", [], "admin");
    fit("ELIGIBLE_WITH_WARNING");
    expect((await actions.startAppeal("calculus")).ok).toBe(true);
    expect(bestFitOf).toHaveBeenCalledWith("admin", course);
    expect(fakeDb.appeal.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ studentId: "admin" }) }));
    fit("NOT_ELIGIBLE_LOCKED");
    expect((await actions.startAppeal("calculus")).ok).toBe(false);
  });

  it("allows a course the student is close to, and snapshots what was missing", async () => {
    fit("NOT_ELIGIBLE_APPEALABLE");
    expect(await actions.startAppeal("calculus")).toEqual({ ok: true, data: { id: "new" } });
    expect(fakeDb.appeal.create.mock.calls[0][0].data).toMatchObject({ studentId: "stu", department: "MATH", unmetRules: [{ type: "minGrade", message: "Needs B-" }] });
  });
  it("refuses a course they already qualify for, and a locked one", async () => {
    fit("ELIGIBLE");
    expect((await actions.startAppeal("calculus")).ok).toBe(false);
    fit("NOT_ELIGIBLE_LOCKED");
    expect((await actions.startAppeal("calculus")).ok).toBe(false);
    expect(fakeDb.appeal.create).not.toHaveBeenCalled();
  });
  it("reopens an existing draft instead of making a second one", async () => {
    fakeDb.appeal.findFirst.mockResolvedValueOnce({ id: "old" });
    expect(await actions.startAppeal("calculus")).toEqual({ ok: true, data: { id: "old" } });
  });
  it("incoming students may ask about any course", async () => {
    state.user = make("INCOMING", [], "stu");
    expect((await actions.startAppeal("calculus")).ok).toBe(true);
    expect(bestFitOf).not.toHaveBeenCalled();
  });
  it("rejects a bad slug", async () => {
    expect((await actions.startAppeal("../x")).ok).toBe(false);
  });
});

describe("deciding", () => {
  const decide = (more = {}) => actions.decideAppeal({ appealId: "a1", decision: "APPROVED", note: "Approved after review.", ...more });

  it("a supervisor of another department is refused and nothing changes", async () => {
    state.user = make("SUPERVISOR", ["SCIENCE"]);
    await expect(decide()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(actions.startReview("a1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
    expect(fakeDb.planEntry.updateMany).not.toHaveBeenCalled();
  });

  it("students, incoming students and counselors cannot decide", async () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR"]) {
      state.user = make(role, ["MATH"]);
      await expect(decide()).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
  });

  it("a supervisor of the department approves, links the plan entry and tells the student", async () => {
    state.user = make("SUPERVISOR", ["MATH"]);
    expect(await decide()).toEqual({ ok: true });
    expect(fakeDb.appeal.update.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", decisionNote: "Approved after review." });
    expect(fakeDb.planEntry.updateMany).toHaveBeenCalledWith({ where: { courseId: "c1", plan: { ownerId: "stu" } }, data: { overrideAppealId: "a1" } });
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "stu", kind: "APPEAL_DECIDED" })]);
  });

  it("a denial changes no plan", async () => {
    state.user = make("ADMIN");
    await decide({ decision: "DENIED", note: "Not this year." });
    expect(fakeDb.planEntry.updateMany).not.toHaveBeenCalled();
  });

  it("needs a note, and cannot decide a draft, a withdrawn or an already decided request", async () => {
    state.user = make("ADMIN");
    expect((await decide({ note: " " })).ok).toBe(false);
    for (const status of ["DRAFT", "WITHDRAWN", "APPROVED", "DENIED"]) {
      fakeDb.appeal.findUnique.mockResolvedValue(appeal({ status }));
      expect((await decide()).ok).toBe(false);
    }
    expect(fakeDb.appeal.update).not.toHaveBeenCalled();
  });
});
