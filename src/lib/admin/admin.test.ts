import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError, assertRole, type SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("@/lib/auth", async () => {
  const guards = await import("@/lib/auth/guards");
  return {
    requireRole: async (...roles: Parameters<typeof guards.assertRole>[1][number][]) =>
      guards.assertRole(state.user as never, roles),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  });
  const db = {
    user: m(),
    roleGrant: m(),
    allowedDomain: m(),
    appSetting: m(),
    requirementRule: m(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import * as graduation from "./graduation";
import * as settings from "./settings";
import * as users from "./users";

const make = (role: SessionUser["role"], id = "actor"): SessionUser => ({
  id,
  role,
  departments: [],
  email: `${id}@pascack.org`,
  name: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.user = null;
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
});

const KINDS = ["ENGLISH", "MATH", "SCI_BIO", "SCI_CHEM", "SCI_PHYS", "SOCIAL_STUDIES", "ARTS", "LIFE_CAREERS", "FIN_LIT", "WORLD_LANG", "PE_HEALTH"];
const gradConfig = () => ({
  rules: KINDS.map((kind) => ({ kind, requiredCredits: 5 })),
  settings: { totalRequired: 120, minPerYear: 30, minFinalYear: 25, maxPeriodsPerYear: 8 },
});

// Every exported admin action with a harmless payload.
const actions: [string, () => Promise<unknown>][] = [
  ["searchUsers", () => users.searchUsers("a")],
  ["changeUserRole", () => users.changeUserRole({ userId: "u", role: "STUDENT", departments: [] })],
  ["createGrant", () => users.createGrant({ email: "a@pascack.org", role: "COUNSELOR", departments: [] })],
  ["deleteGrant", () => users.deleteGrant("g1")],
  ["setSignupMode", () => settings.setSignupMode("OPEN")],
  ["addAllowedDomain", () => settings.addAllowedDomain({ domain: "school.org", cohort: "CURRENT" })],
  ["setDomainEnabled", () => settings.setDomainEnabled("d1", false)],
  ["removeAllowedDomain", () => settings.removeAllowedDomain("d1")],
  ["updateGraduationConfig", () => graduation.updateGraduationConfig(gradConfig())],
];

describe("every admin action is ADMIN only", () => {
  it.each(actions)("%s rejects anonymous callers", async (_n, run) => {
    state.user = null;
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  for (const role of ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR"] as const) {
    it.each(actions)(`%s rejects ${role}`, async (_n, run) => {
      state.user = make(role);
      await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
    });
  }

  it.each(actions)("%s reaches business logic for ADMIN (no auth error)", async (_n, run) => {
    state.user = make("ADMIN");
    fakeDb.user.findUnique.mockResolvedValue(null);
    fakeDb.roleGrant.findUnique.mockResolvedValue(null);
    fakeDb.allowedDomain.findUnique.mockResolvedValue(null);
    fakeDb.user.findMany.mockResolvedValue([]);
    fakeDb.roleGrant.upsert.mockResolvedValue({ id: "g" });
    fakeDb.allowedDomain.create.mockResolvedValue({ id: "d" });
    fakeDb.user.count.mockResolvedValue(2);
    fakeDb.requirementRule.findMany.mockResolvedValue([]);
    fakeDb.appSetting.findUnique.mockResolvedValue(null);
    const out = run();
    await expect(out).resolves.not.toThrow();
  });

  it("assertRole is what gates them (sanity)", () => {
    expect(() => assertRole(make("COUNSELOR"), ["ADMIN"])).toThrow(ForbiddenError);
  });

  it("no database write happens before the role check fails", async () => {
    state.user = make("STUDENT");
    await expect(users.changeUserRole({ userId: "u", role: "ADMIN", departments: [] })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(fakeDb.$transaction).not.toHaveBeenCalled();
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });
});

describe("changeUserRole", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
  });

  it("blocks demoting the last admin", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "t", email: "t@pascack.org", role: "ADMIN", departments: [] });
    fakeDb.user.count.mockResolvedValue(1);
    const r = await users.changeUserRole({ userId: "t", role: "STUDENT", departments: [] });
    expect(r).toEqual({ ok: false, error: "You cannot remove the last admin." });
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("allows demoting an admin when another remains, and audits it", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "t", email: "t@pascack.org", role: "ADMIN", departments: [] });
    fakeDb.user.count.mockResolvedValue(2);
    fakeDb.user.update.mockResolvedValue({ role: "COUNSELOR", departments: [] });
    const r = await users.changeUserRole({ userId: "t", role: "COUNSELOR", departments: [] });
    expect(r).toEqual({ ok: true });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.role_changed", entityId: "t" }),
      expect.anything(),
    );
  });

  it("tells the user when their role changes, and stays quiet when it does not", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "t", email: "t@pascack.org", role: "STUDENT", departments: [] });
    fakeDb.user.count.mockResolvedValue(2);
    fakeDb.user.update.mockResolvedValue({ role: "COUNSELOR", departments: [] });
    await users.changeUserRole({ userId: "t", role: "COUNSELOR", departments: [] });
    expect(notify).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({ userId: "t", kind: "ROLE_CHANGED" })]);
    vi.mocked(notify).mockClear();
    fakeDb.user.update.mockResolvedValue({ role: "STUDENT", departments: [] });
    await users.changeUserRole({ userId: "t", role: "STUDENT", departments: [] });
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses a staff role for a non-pascack address", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "t", email: "kid@gmail.com", role: "STUDENT", departments: [] });
    fakeDb.user.count.mockResolvedValue(2);
    const r = await users.changeUserRole({ userId: "t", role: "COUNSELOR", departments: [] });
    expect(r.ok).toBe(false);
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("requires departments for supervisors and drops them otherwise", async () => {
    expect((await users.changeUserRole({ userId: "t", role: "SUPERVISOR", departments: [] })).ok).toBe(false);

    fakeDb.user.findUnique.mockResolvedValue({ id: "t", email: "t@pascack.org", role: "STUDENT", departments: [] });
    fakeDb.user.count.mockResolvedValue(2);
    fakeDb.user.update.mockResolvedValue({ role: "COUNSELOR", departments: [] });
    await users.changeUserRole({ userId: "t", role: "COUNSELOR", departments: ["MATH"] });
    expect(fakeDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "COUNSELOR", departments: [] } }),
    );
  });

  it("rejects malformed input", async () => {
    expect((await users.changeUserRole({ userId: "", role: "ROOT" })).ok).toBe(false);
    expect((await users.changeUserRole(null)).ok).toBe(false);
  });
});

describe("createGrant", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
    fakeDb.user.count.mockResolvedValue(2);
    fakeDb.roleGrant.upsert.mockResolvedValue({ id: "g1" });
  });

  it("rejects staff grants for non-pascack addresses", async () => {
    for (const email of ["x@gmail.com", "x@pascack.org.evil.com", "x@mail.pascack.org"]) {
      const r = await users.createGrant({ email, role: "COUNSELOR", departments: [] });
      expect(r.ok).toBe(false);
    }
    expect(fakeDb.roleGrant.upsert).not.toHaveBeenCalled();
  });

  it("allows a student invite for any domain", async () => {
    fakeDb.user.findUnique.mockResolvedValue(null);
    const r = await users.createGrant({ email: "Kid@Gmail.com", role: "STUDENT", departments: [] });
    expect(r).toEqual({ ok: true });
    expect(fakeDb.roleGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "kid@gmail.com" } }),
    );
  });

  it("applies immediately when the user already exists", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u9", role: "STUDENT" });
    fakeDb.user.update.mockResolvedValue({});
    await users.createGrant({ email: "t@pascack.org", role: "COUNSELOR", departments: [] });
    expect(fakeDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u9" }, data: { role: "COUNSELOR", departments: [] } }),
    );
  });

  it("does not let a grant demote the last admin", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u9", role: "ADMIN" });
    fakeDb.user.count.mockResolvedValue(1);
    const r = await users.createGrant({ email: "t@pascack.org", role: "COUNSELOR", departments: [] });
    expect(r).toEqual({ ok: false, error: "You cannot remove the last admin." });
  });
});

describe("settings actions", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
  });

  it("rejects an unknown signup mode", async () => {
    expect((await settings.setSignupMode("EVERYONE")).ok).toBe(false);
    expect(fakeDb.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed domains and does not guess any", async () => {
    for (const domain of ["", "no_tld", "http://x.org", "a b.org", "-x.org"]) {
      expect((await settings.addAllowedDomain({ domain, cohort: "CURRENT" })).ok).toBe(false);
    }
  });

  it("rejects a duplicate domain", async () => {
    fakeDb.allowedDomain.findUnique.mockResolvedValue({ id: "d" });
    const r = await settings.addAllowedDomain({ domain: "pascack.org", cohort: "CURRENT" });
    expect(r.ok).toBe(false);
  });
});

describe("updateGraduationConfig", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
    fakeDb.requirementRule.findMany.mockResolvedValue([]);
    fakeDb.appSetting.findUnique.mockResolvedValue(null);
  });
  it("saves all rules and the settings in one transaction and audits it", async () => {
    const r = await graduation.updateGraduationConfig(gradConfig());
    expect(r.ok).toBe(true);
    expect(fakeDb.requirementRule.update).toHaveBeenCalledTimes(11);
    expect(fakeDb.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "settings.graduation" }), expect.anything());
  });
  it("rejects off-step credits, missing rules, duplicates and silly settings, writing nothing", async () => {
    const good = gradConfig();
    const bad = [
      { ...good, rules: good.rules.map((r, i) => (i === 0 ? { ...r, requiredCredits: 5.3 } : r)) },
      { ...good, rules: good.rules.slice(1) },
      { ...good, rules: good.rules.map((r, i) => (i === 1 ? { ...r, kind: "ENGLISH" } : r)) },
      { ...good, settings: { ...good.settings, maxPeriodsPerYear: 0 } },
      { ...good, settings: { ...good.settings, totalRequired: -1 } },
      null,
    ];
    for (const b of bad) expect((await graduation.updateGraduationConfig(b)).ok).toBe(false);
    expect(fakeDb.requirementRule.update).not.toHaveBeenCalled();
  });
});
