import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", async () => {
  const g = await import("@/lib/auth/guards");
  return { requireRole: async (...roles: string[]) => g.assertRole(state.user as never, roles as never) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() });
  const db = { appealQuestion: m(), timelineEvent: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import * as admin from "./admin";

const make = (role: string, departments: string[] = []) => ({ id: "a", role, departments, email: "a@x.org", name: null });
const q = (more = {}) => ({ department: "MATH", prompt: "Why this course?", type: "LONG_TEXT", required: true, sortOrder: 10, active: true, ...more });
const ev = (more = {}) => ({ kind: "APPEAL_WINDOW", audience: "INCOMING", label: "Spring", schoolYear: "2027-28", opensAt: "2028-02-01T00:00:00Z", closesAt: "2028-03-01T00:00:00Z", ...more });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("ADMIN");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.appealQuestion.create.mockResolvedValue({ id: "q1" });
  fakeDb.timelineEvent.create.mockResolvedValue({ id: "t1" });
});

describe("appeal questions", () => {
  it("students and counselors cannot edit", async () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR"]) {
      state.user = make(role, ["MATH"]);
      await expect(admin.saveQuestion(null, q())).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.appealQuestion.create).not.toHaveBeenCalled();
  });
  it("a supervisor edits only their own departments, and never the all-department ones", async () => {
    state.user = make("SUPERVISOR", ["MATH"]);
    expect((await admin.saveQuestion(null, q())).ok).toBe(true);
    await expect(admin.saveQuestion(null, q({ department: "SCIENCE" }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(admin.saveQuestion(null, q({ department: null }))).rejects.toBeInstanceOf(ForbiddenError);
    fakeDb.appealQuestion.findUnique.mockResolvedValue({ id: "q9", department: "SCIENCE", prompt: "x", active: true });
    await expect(admin.saveQuestion("q9", q())).rejects.toBeInstanceOf(ForbiddenError);
    expect(fakeDb.appealQuestion.update).not.toHaveBeenCalled();
  });
  it("admins can add an all-department question, audited", async () => {
    expect((await admin.saveQuestion(null, q({ department: null }))).ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "appeal_question.created" }), expect.anything());
  });
  it("validates input", async () => {
    expect((await admin.saveQuestion(null, q({ prompt: "x" }))).ok).toBe(false);
    expect((await admin.saveQuestion(null, q({ type: "CHOICE", options: ["only"] }))).ok).toBe(false);
    expect((await admin.saveQuestion(null, null)).ok).toBe(false);
  });
});

describe("timeline", () => {
  it("only admins change dates", async () => {
    for (const role of ["STUDENT", "COUNSELOR", "SUPERVISOR"]) {
      state.user = make(role, ["MATH"]);
      await expect(admin.createTimelineEvent(ev())).rejects.toBeInstanceOf(ForbiddenError);
      await expect(admin.deleteTimelineEvent("t1")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.timelineEvent.create).not.toHaveBeenCalled();
  });
  it("creates and audits, and rejects bad dates", async () => {
    expect((await admin.createTimelineEvent(ev())).ok).toBe(true);
    expect((await admin.createTimelineEvent(ev({ schoolYear: "2028" }))).ok).toBe(false);
    expect((await admin.createTimelineEvent(ev({ closesAt: "2027-01-01T00:00:00Z" }))).ok).toBe(false);
    expect((await admin.createTimelineEvent(ev({ opensAt: "not a date" }))).ok).toBe(false);
  });
});
