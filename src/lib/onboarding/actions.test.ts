import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthenticatedError, type SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown, cookie: undefined as string | undefined }));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => {
    const { UnauthenticatedError } = await import("@/lib/auth/guards");
    if (!state.user) throw new UnauthenticatedError();
    return state.user;
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined), set: vi.fn() }) }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), create: vi.fn(), createMany: vi.fn(), count: vi.fn() });
  const db = { user: m(), studentProfile: m(), onboardingProgress: m(), policyAcceptance: m(), policyDocument: m(), interestTag: m(), timelineEvent: m(), plan: m(), course: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { signAge } from "@/lib/age-gate";
import * as actions from "./actions";

const make = (role: SessionUser["role"]): SessionUser => ({ id: "u1", role, departments: [], email: "u@pascack.org", name: null });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "s";
  state.user = make("STUDENT");
  state.cookie = signAge("over13", "s");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.user.findUnique.mockResolvedValue({ ageConfirmed13At: null });
});

describe("onboarding is student only", () => {
  const calls: [string, () => Promise<unknown>][] = [
    ["chooseGrade", () => actions.chooseGrade({ grade: 10 })],
    ["acceptPolicies", () => actions.acceptPolicies()],
    ["setStep", () => actions.setStep(2)],
    ["saveCurrentBackground", () => actions.saveCurrentBackground({ eighthMath: "ALGEBRA_I" })],
    ["saveIncomingBackground", () => actions.saveIncomingBackground({})],
    ["saveMajor", () => actions.saveMajor({ intendedMajor: "x" })],
    ["finishOnboarding", () => actions.finishOnboarding()],
  ];
  it.each(calls)("%s rejects anonymous callers", async (_n, run) => {
    state.user = null;
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  for (const role of ["COUNSELOR", "SUPERVISOR", "ADMIN"] as const) {
    it.each(calls)(`%s refuses ${role} and writes nothing`, async (_n, run) => {
      state.user = make(role);
      expect(await run()).toMatchObject({ ok: false });
      expect(fakeDb.user.update).not.toHaveBeenCalled();
      expect(fakeDb.studentProfile.upsert).not.toHaveBeenCalled();
    });
  }
});

describe("chooseGrade", () => {
  it("sets a student role, never a staff role, whatever is sent", async () => {
    for (const g of [8, 9, 10, 11, 12]) {
      fakeDb.user.update.mockClear();
      const r = await actions.chooseGrade({ grade: g, role: "ADMIN" });
      expect(r.ok).toBe(true);
      expect(["STUDENT", "INCOMING"]).toContain(fakeDb.user.update.mock.calls[0][0].data.role);
    }
    expect((await actions.chooseGrade({ grade: 13 })).ok).toBe(false);
    expect((await actions.chooseGrade({ grade: "ADMIN" })).ok).toBe(false);
  });
  it("stores a confirmation time, never an age", async () => {
    await actions.chooseGrade({ grade: 9 });
    const data = fakeDb.user.update.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(["ageConfirmed13At", "role"]);
    expect(data.ageConfirmed13At).toBeInstanceOf(Date);
  });
  it("stores nothing for an under 13 answer", async () => {
    state.cookie = signAge("under13", "s");
    expect(await actions.chooseGrade({ grade: 9 })).toMatchObject({ ok: false });
    expect(fakeDb.user.update).not.toHaveBeenCalled();
    expect(fakeDb.studentProfile.upsert).not.toHaveBeenCalled();
  });
  it("needs the checkbox when there is no cookie and no earlier confirmation", async () => {
    state.cookie = undefined;
    expect(await actions.chooseGrade({ grade: 9 })).toMatchObject({ ok: false });
    expect((await actions.chooseGrade({ grade: 9 }, true)).ok).toBe(true);
  });
  it("ignores a forged cookie", async () => {
    state.cookie = signAge("over13", "wrong");
    expect(await actions.chooseGrade({ grade: 9 })).toMatchObject({ ok: false });
  });
});

describe("8th grade background", () => {
  beforeEach(() => {
    state.user = make("INCOMING");
    fakeDb.studentProfile.findUnique.mockResolvedValue({ cohort: "INCOMING_8" });
    fakeDb.interestTag.findMany.mockResolvedValue([{ id: "t1" }]);
    fakeDb.timelineEvent.findMany.mockResolvedValue([]);
  });
  const ok = { interests: ["coding-cs"], eighthMath: "ALGEBRA_I", eighthMathGrade: "A", honest: true };
  it("will not save without the honesty confirmation", async () => {
    expect((await actions.saveIncomingBackground({ ...ok, honest: false })).ok).toBe(false);
    expect(fakeDb.studentProfile.update).not.toHaveBeenCalled();
  });
  it("saves a labeled snapshot with an expiry and an honesty timestamp", async () => {
    expect((await actions.saveIncomingBackground(ok)).ok).toBe(true);
    const data = fakeDb.studentProfile.update.mock.calls[0][0].data;
    expect(data.selfReported).toBe(true);
    expect(data.honestyConfirmedAt).toBeInstanceOf(Date);
    expect(data.snapshotExpiresAt).toBeInstanceOf(Date);
  });
  it("refuses a current student cohort for the 8th grade form and the reverse", async () => {
    fakeDb.studentProfile.findUnique.mockResolvedValue({ cohort: "CURRENT" });
    expect((await actions.saveIncomingBackground(ok)).ok).toBe(false);
    fakeDb.studentProfile.findUnique.mockResolvedValue({ cohort: "INCOMING_8" });
    expect((await actions.saveCurrentBackground({ eighthMath: "ALGEBRA_I" })).ok).toBe(false);
  });
});
