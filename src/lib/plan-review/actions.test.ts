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
vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() });
  const db = { plan: m(), planEntry: m(), planComment: m(), user: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { notify } from "@/lib/notifications";
import * as review from "./actions";

let n = 0;
const make = (role: string, id?: string) => ({ id: id ?? `u${++n}`, role, departments: [], email: "x@y.org", name: null });
const plan = (more = {}) => ({ id: "p1", name: "Plan A", ownerId: "stu", status: "DRAFT", _count: { entries: 3 }, ...more });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("STUDENT", "stu");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.plan.findFirst.mockResolvedValue(plan());
  fakeDb.plan.findUnique.mockResolvedValue(plan({ status: "SUBMITTED" }));
  fakeDb.user.findMany.mockResolvedValue([{ id: "cou" }]);
});

describe("student actions", () => {
  it("looks the plan up by owner, so another student's plan is not found", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(null);
    for (const f of [review.submitPlan, review.withdrawPlan, review.reopenPlan]) expect(await f("p1")).toEqual({ ok: false, error: "Plan not found." });
    for (const c of fakeDb.plan.findFirst.mock.calls) expect(c[0].where).toMatchObject({ ownerId: "stu" });
    expect(fakeDb.plan.update).not.toHaveBeenCalled();
  });
  it("needs a signed in user", async () => {
    state.user = null;
    await expect(review.submitPlan("p1")).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  it("submits a draft, tells reviewers, and refuses an empty plan", async () => {
    expect((await review.submitPlan("p1")).ok).toBe(true);
    expect(fakeDb.plan.update.mock.calls[0][0].data).toMatchObject({ status: "SUBMITTED" });
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "cou" })]);
    fakeDb.plan.findFirst.mockResolvedValue(plan({ _count: { entries: 0 } }));
    expect((await review.submitPlan("p1")).ok).toBe(false);
  });
  it("cannot submit twice, or reopen a plan that is not approved", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(plan({ status: "SUBMITTED" }));
    expect((await review.submitPlan("p1")).ok).toBe(false);
    fakeDb.plan.findFirst.mockResolvedValue(plan({ status: "DRAFT" }));
    expect((await review.reopenPlan("p1")).ok).toBe(false);
    fakeDb.plan.findFirst.mockResolvedValue(plan({ status: "APPROVED" }));
    expect((await review.reopenPlan("p1")).ok).toBe(true);
    expect(fakeDb.plan.update.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "DRAFT", reviewerId: null });
  });
  it("can resubmit after changes were requested", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(plan({ status: "CHANGES_REQUESTED" }));
    expect((await review.submitPlan("p1")).ok).toBe(true);
  });
});

describe("only counselors and admins decide", () => {
  it("a student cannot approve or request changes", async () => {
    for (const role of ["STUDENT", "INCOMING", "SUPERVISOR"]) {
      state.user = make(role);
      await expect(review.approvePlan("p1")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(review.requestPlanChanges("p1", "fix it")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.plan.update).not.toHaveBeenCalled();
  });
  it("a counselor approves a submitted plan and the student is told", async () => {
    state.user = make("COUNSELOR", "cou");
    expect((await review.approvePlan("p1")).ok).toBe(true);
    expect(fakeDb.plan.update.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", reviewerId: "cou" });
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "stu" })]);
  });
  it("asking for changes needs a note and saves it as a comment", async () => {
    state.user = make("COUNSELOR", "cou");
    expect((await review.requestPlanChanges("p1", "  ")).ok).toBe(false);
    expect((await review.requestPlanChanges("p1", "Add a science course.")).ok).toBe(true);
    expect(fakeDb.planComment.create).toHaveBeenCalledWith({ data: { planId: "p1", authorId: "cou", body: "Add a science course." } });
  });
  it("cannot decide a draft or an already approved plan", async () => {
    state.user = make("ADMIN");
    for (const status of ["DRAFT", "APPROVED"]) {
      fakeDb.plan.findUnique.mockResolvedValue(plan({ status }));
      expect((await review.approvePlan("p1")).ok).toBe(false);
    }
    expect(fakeDb.plan.update).not.toHaveBeenCalled();
  });
});

describe("comments", () => {
  const body = { planId: "p1", body: "Looks good" };
  it("the owner and counselors can comment, anyone else cannot", async () => {
    expect((await review.addComment(body)).ok).toBe(true);
    state.user = make("COUNSELOR");
    expect((await review.addComment(body)).ok).toBe(true);
    for (const role of ["STUDENT", "SUPERVISOR", "INCOMING"]) {
      state.user = make(role);
      expect(await review.addComment(body)).toEqual({ ok: false, error: "Plan not found." });
    }
    expect(fakeDb.planComment.create).toHaveBeenCalledTimes(2);
  });
  it("notifies the other side", async () => {
    await review.addComment(body);
    expect(notify).toHaveBeenLastCalledWith(expect.anything(), [expect.objectContaining({ userId: "cou" })]);
    state.user = make("COUNSELOR", "cou2");
    await review.addComment(body);
    expect(notify).toHaveBeenLastCalledWith(expect.anything(), [expect.objectContaining({ userId: "stu" })]);
  });
  it("limits length, rejects empty text, and checks the entry belongs to the plan", async () => {
    expect((await review.addComment({ planId: "p1", body: "x".repeat(1001) })).ok).toBe(false);
    expect((await review.addComment({ planId: "p1", body: "   " })).ok).toBe(false);
    fakeDb.planEntry.findFirst.mockResolvedValue(null);
    expect((await review.addComment({ ...body, entryId: "other" })).ok).toBe(false);
    expect(fakeDb.planComment.create).not.toHaveBeenCalled();
  });
  it("keeps comment text out of notifications", async () => {
    await review.addComment({ planId: "p1", body: "my secret grades" });
    expect(JSON.stringify(vi.mocked(notify).mock.calls)).not.toContain("secret");
  });
});
