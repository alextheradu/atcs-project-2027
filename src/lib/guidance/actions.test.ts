import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", async () => {
  const g = await import("@/lib/auth/guards");
  return { requireRole: async (...r: string[]) => g.assertRole(state.user as never, r as never) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
const fakeDb = vi.hoisted(() => {
  const db = { appSetting: { findUnique: vi.fn(), upsert: vi.fn() }, $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import { saveGuidance } from "./actions";
import { DEFAULT_GUIDANCE } from "./index";

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "a", role: "ADMIN", departments: [], email: "a@x.org", name: null };
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.appSetting.findUnique.mockResolvedValue(null);
});

describe("saveGuidance", () => {
  it("is admin only", async () => {
    for (const role of ["STUDENT", "COUNSELOR", "SUPERVISOR"]) {
      state.user = { id: "x", role, departments: [], email: "x@x.org", name: null };
      await expect(saveGuidance(DEFAULT_GUIDANCE)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.appSetting.upsert).not.toHaveBeenCalled();
  });
  it("saves valid guidance and audits it", async () => {
    expect(await saveGuidance(DEFAULT_GUIDANCE)).toEqual({ ok: true });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "settings.guidance" }), expect.anything());
  });
  it("rejects silly years and writes nothing", async () => {
    expect((await saveGuidance({ ...DEFAULT_GUIDANCE, base: { ...DEFAULT_GUIDANCE.base, MATH: 7 } })).ok).toBe(false);
    expect((await saveGuidance(null)).ok).toBe(false);
    expect(fakeDb.appSetting.upsert).not.toHaveBeenCalled();
  });
});
