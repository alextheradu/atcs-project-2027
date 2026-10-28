import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => {
  const db = {
    user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    roleGrant: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

import { writeAudit } from "@/lib/audit";
import { applyToExistingUser } from "./apply";
import type { PolicyResult } from "./policy";

type Allowed = Extract<PolicyResult, { allow: true }>;
const result = (over: Partial<Allowed>): Allowed => ({
  allow: true,
  role: "STUDENT",
  cohort: null,
  departments: [],
  source: "domain",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.user.update.mockResolvedValue({ role: "COUNSELOR", departments: [] });
});

describe("applyToExistingUser", () => {
  it("does nothing when the policy leaves the role alone", async () => {
    await applyToExistingUser("u", "a@pascack.org", result({ role: null, source: "existing" }));
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("does nothing when the role already matches", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u", role: "COUNSELOR", departments: [] });
    await applyToExistingUser("u", "a@pascack.org", result({ role: "COUNSELOR", source: "grant" }));
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("applies an unapplied grant, marks it applied, and audits it", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u", role: "STUDENT", departments: [] });
    await applyToExistingUser("u", "a@pascack.org", result({ role: "COUNSELOR", source: "grant" }));
    expect(fakeDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u" }, data: { role: "COUNSELOR", departments: [] } }),
    );
    expect(fakeDb.roleGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "a@pascack.org", appliedAt: null } }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.role_applied_grant" }),
      expect.anything(),
    );
  });

  it("ADMIN_EMAILS never re-promotes once an admin exists", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u", role: "STUDENT", departments: [] });
    fakeDb.user.count.mockResolvedValue(1);
    await applyToExistingUser("u", "owner@gmail.com", result({ role: "ADMIN", source: "admin_env" }));
    expect(fakeDb.user.update).not.toHaveBeenCalled();
  });

  it("ADMIN_EMAILS bootstraps when there is no admin at all", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ id: "u", role: "STUDENT", departments: [] });
    fakeDb.user.count.mockResolvedValue(0);
    fakeDb.user.update.mockResolvedValue({ role: "ADMIN", departments: [] });
    await applyToExistingUser("u", "owner@gmail.com", result({ role: "ADMIN", source: "admin_env" }));
    expect(fakeDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: "ADMIN", departments: [] } }),
    );
    expect(fakeDb.roleGrant.updateMany).not.toHaveBeenCalled();
  });
});
