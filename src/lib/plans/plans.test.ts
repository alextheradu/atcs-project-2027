import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthenticatedError, type SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("@/lib/auth", async () => {
  const guards = await import("@/lib/auth/guards");
  return {
    requireUser: async () =>
      guards.assertRole(state.user as never, ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"]),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), enforceLimit: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({
    findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(),
    createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(),
  });
  const db = { plan: m(), planEntry: m(), course: m(), appeal: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import * as plans from "./actions";

const me: SessionUser = { id: "me", role: "STUDENT", departments: [], email: "me@pascack.org", name: null };
const plan = (over: Record<string, unknown> = {}) => ({ id: "p1", ownerId: "me", name: "Plan A", isPrimary: true, status: "DRAFT", entries: [], ...over });
const entry = (planOver: Record<string, unknown> = {}) => ({ id: "e1", planId: "p1", courseId: "c1", gradeLevel: 9, status: "PLANNED", plan: plan(planOver) });
const course = (over: Record<string, unknown> = {}) => ({ id: "c1", name: "Geometry", credits: 5, archived: false, plannable: true, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = me;
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.plan.findMany.mockResolvedValue([]);
  fakeDb.plan.count.mockResolvedValue(0);
  fakeDb.plan.create.mockResolvedValue({ id: "new" });
  fakeDb.planEntry.create.mockResolvedValue({ id: "ne" });
});

const calls: [string, () => Promise<unknown>][] = [
  ["createPlan", () => plans.createPlan()],
  ["renamePlan", () => plans.renamePlan("p1", "X")],
  ["clonePlan", () => plans.clonePlan("p1")],
  ["deletePlan", () => plans.deletePlan("p1")],
  ["setPrimaryPlan", () => plans.setPrimaryPlan("p1")],
  ["addEntry", () => plans.addEntry({ planId: "p1", courseId: "c1", gradeLevel: 9 })],
  ["moveEntry", () => plans.moveEntry({ entryId: "e1", gradeLevel: 10 })],
  ["removeEntry", () => plans.removeEntry("e1")],
  ["updateEntry", () => plans.updateEntry({ entryId: "e1", status: "COMPLETED" })],
];

describe("authentication", () => {
  it.each(calls)("%s rejects anonymous callers", async (_n, run) => {
    state.user = null;
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(fakeDb.plan.create).not.toHaveBeenCalled();
  });
});

describe("ownership: someone else's plan is just not found", () => {
  beforeEach(() => {
    fakeDb.plan.findFirst.mockResolvedValue(null);
    fakeDb.planEntry.findFirst.mockResolvedValue(null);
  });
  const others = calls.filter(([n]) => n !== "createPlan");
  it.each(others)("%s returns not found and writes nothing", async (_n, run) => {
    const r = (await run()) as { ok: boolean; error?: string };
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Plan not found.");
    for (const fn of [fakeDb.plan.update, fakeDb.plan.delete, fakeDb.plan.updateMany, fakeDb.planEntry.create, fakeDb.planEntry.update, fakeDb.planEntry.delete]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
  it("the ownership check is part of the query, not a later comparison", async () => {
    await plans.deletePlan("p1");
    expect(fakeDb.plan.findFirst).toHaveBeenCalledWith({ where: { id: "p1", ownerId: "me" } });
    await plans.moveEntry({ entryId: "e1", gradeLevel: 10 });
    expect(fakeDb.planEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "e1", plan: { ownerId: "me" } } }),
    );
  });
});

describe("staff cannot edit a student's plan through these actions", () => {
  for (const role of ["COUNSELOR", "SUPERVISOR", "ADMIN"] as const) {
    it(`${role} gets not found for a plan they do not own`, async () => {
      state.user = { ...me, id: "staff", role };
      fakeDb.plan.findFirst.mockResolvedValue(null);
      fakeDb.planEntry.findFirst.mockResolvedValue(null);
      for (const run of [
        () => plans.addEntry({ planId: "p1", courseId: "c1", gradeLevel: 9 }),
        () => plans.moveEntry({ entryId: "e1", gradeLevel: 10 }),
        () => plans.removeEntry("e1"),
        () => plans.deletePlan("p1"),
        () => plans.setPrimaryPlan("p1"),
      ]) {
        expect(await run()).toMatchObject({ ok: false, error: "Plan not found." });
      }
      expect(fakeDb.plan.findFirst).toHaveBeenCalledWith({ where: { id: "p1", ownerId: "staff" } });
    });
  }
});

describe("submitted and approved plans are read-only", () => {
  for (const status of ["SUBMITTED", "APPROVED"]) {
    it(`${status}: add, move, remove, update and rename are refused`, async () => {
      fakeDb.plan.findFirst.mockResolvedValue(plan({ status }));
      fakeDb.planEntry.findFirst.mockResolvedValue(entry({ status }));
      fakeDb.course.findUnique.mockResolvedValue(course());
      const results = await Promise.all([
        plans.addEntry({ planId: "p1", courseId: "c1", gradeLevel: 9 }),
        plans.moveEntry({ entryId: "e1", gradeLevel: 10 }),
        plans.removeEntry("e1"),
        plans.updateEntry({ entryId: "e1", status: "COMPLETED" }),
        plans.renamePlan("p1", "New"),
      ]);
      for (const r of results) expect(r.ok).toBe(false);
      expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
      expect(fakeDb.planEntry.update).not.toHaveBeenCalled();
      expect(fakeDb.planEntry.delete).not.toHaveBeenCalled();
      expect(fakeDb.plan.update).not.toHaveBeenCalled();
    });
  }
  it("CHANGES_REQUESTED and DRAFT plans can be edited", async () => {
    for (const status of ["DRAFT", "CHANGES_REQUESTED"]) {
      fakeDb.planEntry.findFirst.mockResolvedValue(entry({ status }));
      expect((await plans.moveEntry({ entryId: "e1", gradeLevel: 10 })).ok).toBe(true);
    }
  });
  it("a submitted plan cannot be deleted either", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(plan({ status: "SUBMITTED" }));
    expect((await plans.deletePlan("p1")).ok).toBe(false);
    expect(fakeDb.plan.delete).not.toHaveBeenCalled();
  });
});

describe("createPlan", () => {
  it("makes the first plan primary and names it Plan A", async () => {
    await plans.createPlan();
    expect(fakeDb.plan.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ownerId: "me", name: "Plan A", isPrimary: true } }));
  });
  it("names the next plan Plan B and keeps it non-primary", async () => {
    fakeDb.plan.findMany.mockResolvedValue([{ name: "Plan A" }]);
    await plans.createPlan();
    expect(fakeDb.plan.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ownerId: "me", name: "Plan B", isPrimary: false } }));
  });
  it("is rate limited per user", async () => {
    await plans.createPlan();
    expect(enforceLimit).toHaveBeenCalledWith("plan", "me");
    vi.mocked(enforceLimit).mockImplementationOnce(() => {
      throw new RateLimitError(1000);
    });
    const r = await plans.createPlan();
    expect(r.ok).toBe(false);
  });
  it("caps the number of plans", async () => {
    fakeDb.plan.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ name: `P${i}` })));
    expect((await plans.createPlan()).ok).toBe(false);
    expect(fakeDb.plan.create).not.toHaveBeenCalled();
  });
  it("rejects blank or very long names", async () => {
    expect((await plans.createPlan("   ")).ok).toBe(false);
    expect((await plans.createPlan("x".repeat(61))).ok).toBe(false);
  });
});

describe("clonePlan", () => {
  it("copies the entries into a new non-primary draft", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(
      plan({ entries: [{ courseId: "c1", gradeLevel: 9, status: "COMPLETED", grade: "A", credits: 5, source: "IMPORT", note: null }] }),
    );
    fakeDb.plan.count.mockResolvedValue(1);
    const r = await plans.clonePlan("p1");
    expect(r.ok).toBe(true);
    expect(fakeDb.plan.create).toHaveBeenCalledWith(expect.objectContaining({ data: { ownerId: "me", name: "Plan A copy", isPrimary: false } }));
    const copied = fakeDb.planEntry.createMany.mock.calls[0][0].data;
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ planId: "new", courseId: "c1", grade: "A" });
    expect(copied[0]).not.toHaveProperty("overrideAppealId");
  });
});

describe("setPrimaryPlan", () => {
  it("clears the old primary before setting the new one, in one transaction", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(plan({ id: "p2", isPrimary: false }));
    const order: string[] = [];
    fakeDb.plan.updateMany.mockImplementation(async () => void order.push("clear"));
    fakeDb.plan.update.mockImplementation(async () => void order.push("set"));
    await plans.setPrimaryPlan("p2");
    expect(order).toEqual(["clear", "set"]);
    expect(fakeDb.$transaction).toHaveBeenCalledTimes(1);
    expect(fakeDb.plan.updateMany).toHaveBeenCalledWith({ where: { ownerId: "me", isPrimary: true }, data: { isPrimary: false } });
  });
});

describe("deletePlan", () => {
  it("promotes the most recent remaining plan when the primary is deleted", async () => {
    fakeDb.plan.findFirst.mockResolvedValueOnce(plan({ isPrimary: true })).mockResolvedValueOnce({ id: "p2" });
    await plans.deletePlan("p1");
    expect(fakeDb.plan.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(fakeDb.plan.update).toHaveBeenCalledWith({ where: { id: "p2" }, data: { isPrimary: true } });
  });
  it("does not promote anything when a non-primary plan is deleted", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(plan({ isPrimary: false }));
    await plans.deletePlan("p1");
    expect(fakeDb.plan.update).not.toHaveBeenCalled();
  });
});

describe("addEntry", () => {
  const input = { planId: "p1", courseId: "c1", gradeLevel: 10 };
  beforeEach(() => {
    fakeDb.plan.findFirst.mockResolvedValue(plan());
    fakeDb.course.findUnique.mockResolvedValue(course());
    fakeDb.planEntry.findFirst.mockResolvedValue(null);
    fakeDb.planEntry.count.mockResolvedValue(3);
  });
  it("adds with the catalog credits", async () => {
    fakeDb.course.findUnique.mockResolvedValue(course({ credits: 2.5 }));
    expect((await plans.addEntry(input)).ok).toBe(true);
    expect(fakeDb.planEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ credits: 2.5, gradeLevel: 10, status: "PLANNED", source: "MANUAL" }) }),
    );
  });
  it("rejects archived, non-plannable and missing courses", async () => {
    for (const c of [course({ archived: true }), course({ plannable: false }), null]) {
      fakeDb.course.findUnique.mockResolvedValue(c);
      expect((await plans.addEntry(input)).ok).toBe(false);
    }
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });
  it("rejects a course that is already in the plan", async () => {
    fakeDb.planEntry.findFirst.mockResolvedValue({ id: "x" });
    const r = await plans.addEntry(input);
    expect(r).toMatchObject({ ok: false });
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });
  it("turns a unique-index race into the same friendly error", async () => {
    fakeDb.planEntry.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect((await plans.addEntry(input)).ok).toBe(false);
  });
  it("rejects a grade outside 9 to 12", async () => {
    for (const g of [8, 13, 9.5, "10"]) expect((await plans.addEntry({ ...input, gradeLevel: g })).ok).toBe(false);
  });
  it("rejects a plan that is full", async () => {
    fakeDb.planEntry.count.mockResolvedValue(60);
    expect((await plans.addEntry(input)).ok).toBe(false);
  });
});

describe("updateEntry", () => {
  beforeEach(() => {
    fakeDb.planEntry.findFirst.mockResolvedValue({ ...entry(), status: "PLANNED" });
  });
  it("stores a grade only for completed courses", async () => {
    await plans.updateEntry({ entryId: "e1", status: "COMPLETED", grade: "B_PLUS" });
    expect(fakeDb.planEntry.update).toHaveBeenLastCalledWith({ where: { id: "e1" }, data: { status: "COMPLETED", grade: "B_PLUS" } });
    await plans.updateEntry({ entryId: "e1", status: "PLANNED", grade: "A" });
    expect(fakeDb.planEntry.update).toHaveBeenLastCalledWith({ where: { id: "e1" }, data: { status: "PLANNED", grade: null } });
  });
  it("lets the student override earned credits in half steps", async () => {
    await plans.updateEntry({ entryId: "e1", credits: 6 });
    expect(fakeDb.planEntry.update).toHaveBeenLastCalledWith({ where: { id: "e1" }, data: { grade: null, credits: 6 } });
    expect((await plans.updateEntry({ entryId: "e1", credits: 5.3 })).ok).toBe(false);
    expect((await plans.updateEntry({ entryId: "e1", credits: -1 })).ok).toBe(false);
    expect((await plans.updateEntry({ entryId: "e1", credits: 31 })).ok).toBe(false);
  });
  it("rejects unknown statuses and grades", async () => {
    expect((await plans.updateEntry({ entryId: "e1", status: "DONE" })).ok).toBe(false);
    expect((await plans.updateEntry({ entryId: "e1", status: "COMPLETED", grade: "E" })).ok).toBe(false);
  });
});

describe("addEntry and approved appeals", () => {
  it("links an approved appeal so the course reads Approved via appeal from the start", async () => {
    state.user = { id: "u1", role: "STUDENT", departments: [], email: "u@x.org", name: null };
    fakeDb.plan.findFirst.mockResolvedValue({ id: "p1", status: "DRAFT" });
    fakeDb.course.findUnique.mockResolvedValue({ id: "c1", name: "Calculus", archived: false, plannable: true, credits: 5 });
    fakeDb.planEntry.findFirst.mockResolvedValue(null);
    fakeDb.planEntry.count.mockResolvedValue(0);
    fakeDb.appeal.findFirst.mockResolvedValue({ id: "ap1" });
    fakeDb.planEntry.create.mockResolvedValue({ id: "e1" });
    await plans.addEntry({ planId: "p1", courseId: "c1", gradeLevel: 11 });
    expect(fakeDb.appeal.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: "u1", targetCourseId: "c1", status: "APPROVED" } }));
    expect(fakeDb.planEntry.create.mock.calls.at(-1)?.[0].data.overrideAppealId).toBe("ap1");
  });
});
