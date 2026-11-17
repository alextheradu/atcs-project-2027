import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => {
    const { UnauthenticatedError } = await import("@/lib/auth/guards");
    if (!state.user) throw new UnauthenticatedError();
    return state.user;
  },
}));
const fakeDb = vi.hoisted(() => ({ studentProfile: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { savePriorMath } from "./prior";

const make = (role: SessionUser["role"]): SessionUser => ({ id: "u1", role, departments: [], email: "u@pascack.org", name: null });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("STUDENT");
  fakeDb.studentProfile.findUnique.mockResolvedValue({ userId: "u1" });
});

describe("savePriorMath", () => {
  it("saves the signed-in student's own 8th grade math and grade", async () => {
    expect(await savePriorMath({ eighthMath: "ALGEBRA_I", eighthMathGrade: "B_PLUS" })).toEqual({ ok: true });
    expect(fakeDb.studentProfile.update).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { eighthMath: "ALGEBRA_I", eighthMathGrade: "B_PLUS" } });
  });
  it("stores no grade when the student leaves it blank", async () => {
    await savePriorMath({ eighthMath: "PRE_ALGEBRA", eighthMathGrade: "" });
    expect(fakeDb.studentProfile.update).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { eighthMath: "PRE_ALGEBRA", eighthMathGrade: null } });
  });
  it("refuses staff without a student workspace, and bad input", async () => {
    state.user = make("COUNSELOR");
    expect(await savePriorMath({ eighthMath: "ALGEBRA_I" })).toMatchObject({ ok: false });
    state.user = make("STUDENT");
    expect(await savePriorMath({ eighthMath: "CALCULUS" })).toMatchObject({ ok: false });
    expect(await savePriorMath({ eighthMath: "ALGEBRA_I", eighthMathGrade: "Z" })).toMatchObject({ ok: false });
    expect(fakeDb.studentProfile.update).not.toHaveBeenCalled();
  });
  it("needs a profile, and never touches anyone else's", async () => {
    fakeDb.studentProfile.findUnique.mockResolvedValue(null);
    expect(await savePriorMath({ eighthMath: "ALGEBRA_I" })).toMatchObject({ ok: false });
    expect(fakeDb.studentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "u1" }, select: { userId: true } });
    expect(fakeDb.studentProfile.update).not.toHaveBeenCalled();
  });
  it("rejects a signed-out caller", async () => {
    state.user = null;
    await expect(savePriorMath({ eighthMath: "ALGEBRA_I" })).rejects.toThrow();
  });
});
