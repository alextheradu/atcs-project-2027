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
const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() });
  const db = { deletionRequest: m(), user: m(), $transaction: vi.fn() };
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { enforceLimit } from "@/lib/rate-limit";
import * as actions from "./actions";
import { hashEmail, signConfirm } from "./index";

vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), enforceLimit: vi.fn() }));

process.env.AUTH_SECRET = "test-secret";
const make = (role: string, id: string, email = "stu@example.org") => ({ id, role, departments: [], email, name: null });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("STUDENT", "stu");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.user.findUnique.mockResolvedValue({ role: "STUDENT" });
  fakeDb.deletionRequest.findFirst.mockResolvedValue(null);
  fakeDb.deletionRequest.create.mockResolvedValue({ id: "req1" });
  fakeDb.deletionRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("requestDeletion", () => {
  it("needs a signed in user", async () => {
    state.user = null;
    await expect(actions.requestDeletion()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  it("stores only a hash of the email and sends a confirmation link", async () => {
    expect(await actions.requestDeletion()).toEqual({ ok: true });
    const data = fakeDb.deletionRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: "stu", source: "self", emailHash: hashEmail("stu@example.org", "test-secret") });
    expect(JSON.stringify(data)).not.toContain("stu@example.org");
    const sent = vi.mocked(notify).mock.calls[0][1][0];
    expect(sent).toMatchObject({ userId: "stu", kind: "DELETION_CONFIRM" });
    expect(sent.url).toMatch(/^\/settings\/delete\?token=/);
    expect(sent.body).not.toContain("@");
    expect(writeAudit).toHaveBeenCalled();
  });
  it("does not delete anything and does not schedule yet", async () => {
    await actions.requestDeletion();
    expect(fakeDb.deletionRequest.create.mock.calls[0][0].data.status).toBeUndefined();
    expect(fakeDb.deletionRequest.create.mock.calls[0][0].data.scheduledFor).toBeUndefined();
  });
  it("refuses a second open request", async () => {
    fakeDb.deletionRequest.findFirst.mockResolvedValue({ id: "old", status: "SCHEDULED" });
    expect(await actions.requestDeletion()).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.create).not.toHaveBeenCalled();
  });
  it("refuses the last admin", async () => {
    state.user = make("ADMIN", "adm");
    fakeDb.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    fakeDb.user.count.mockResolvedValue(0);
    expect(await actions.requestDeletion()).toMatchObject({ ok: false, error: expect.stringContaining("only admin") });
    expect(fakeDb.deletionRequest.create).not.toHaveBeenCalled();
  });
  it("lets an admin go when another admin exists", async () => {
    state.user = make("ADMIN", "adm");
    fakeDb.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    fakeDb.user.count.mockResolvedValue(1);
    expect(await actions.requestDeletion()).toEqual({ ok: true });
  });
  it("is rate limited", async () => {
    const { RateLimitError } = await import("@/lib/rate-limit");
    vi.mocked(enforceLimit).mockImplementationOnce(() => { throw new RateLimitError(1000); });
    expect(await actions.requestDeletion()).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.create).not.toHaveBeenCalled();
  });
});

describe("confirmDeletion", () => {
  const awaiting = { id: "req1", userId: "stu", status: "AWAITING_CONFIRMATION", source: "self", scheduledFor: null };
  beforeEach(() => fakeDb.deletionRequest.findFirst.mockResolvedValue(awaiting));

  it("schedules 14 days out and tells the person", async () => {
    const before = Date.now();
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret"))).toEqual({ ok: true });
    const call = fakeDb.deletionRequest.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ id: "req1", status: "AWAITING_CONFIRMATION" });
    expect(call.data.status).toBe("SCHEDULED");
    expect(call.data.scheduledFor.getTime() - before).toBeGreaterThanOrEqual(14 * 86_400_000 - 1000);
    expect(vi.mocked(notify).mock.calls[0][1][0]).toMatchObject({ kind: "DELETION_SCHEDULED", userId: "stu" });
  });
  it("a link made for someone else does nothing", async () => {
    state.user = make("STUDENT", "other");
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret"))).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.updateMany).not.toHaveBeenCalled();
  });
  it("rejects forged, expired and junk tokens", async () => {
    expect(await actions.confirmDeletion("x".repeat(40))).toMatchObject({ ok: false });
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "wrong-secret"))).toMatchObject({ ok: false });
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret", Date.now() - 2 * 86_400_000))).toMatchObject({ ok: false });
    expect(await actions.confirmDeletion(undefined)).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.updateMany).not.toHaveBeenCalled();
  });
  it("looks the request up by owner", async () => {
    await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret"));
    expect(fakeDb.deletionRequest.findFirst.mock.calls[0][0].where).toMatchObject({ id: "req1", userId: "stu" });
  });
  it("a second click is a no-op", async () => {
    fakeDb.deletionRequest.updateMany.mockResolvedValue({ count: 0 });
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret"))).toMatchObject({ ok: false });
    expect(notify).not.toHaveBeenCalled();
  });
  it("cannot revive a cancelled request", async () => {
    fakeDb.deletionRequest.findFirst.mockResolvedValue({ ...awaiting, status: "CANCELLED" });
    expect(await actions.confirmDeletion(signConfirm("req1", "stu", "test-secret"))).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.updateMany).not.toHaveBeenCalled();
  });
});

describe("cancelDeletion", () => {
  it("cancels the signed in person's own open request only", async () => {
    fakeDb.deletionRequest.findFirst.mockResolvedValue({ id: "req1", userId: "stu", status: "SCHEDULED", source: "self", scheduledFor: new Date() });
    expect(await actions.cancelDeletion()).toEqual({ ok: true });
    expect(fakeDb.deletionRequest.findFirst.mock.calls[0][0].where).toMatchObject({ userId: "stu" });
    expect(fakeDb.deletionRequest.updateMany.mock.calls[0][0].where).toMatchObject({ id: "req1", userId: "stu" });
  });
  it("cannot cancel a guardian request", async () => {
    fakeDb.deletionRequest.findFirst.mockResolvedValue({ id: "req1", userId: "stu", status: "SCHEDULED", source: "guardian", scheduledFor: new Date() });
    expect(await actions.cancelDeletion()).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.updateMany).not.toHaveBeenCalled();
  });
  it("reports nothing to cancel", async () => {
    expect(await actions.cancelDeletion()).toMatchObject({ ok: false });
  });
});

describe("admin actions", () => {
  beforeEach(() => { state.user = make("ADMIN", "adm", "adm@pascack.org"); });

  it("only admins can record a guardian request or cancel any request", async () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR"]) {
      state.user = make(role, "x");
      await expect(actions.recordGuardianRequest("stu@example.org")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(actions.adminCancelDeletion("req1")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(fakeDb.deletionRequest.create).not.toHaveBeenCalled();
  });
  it("records a guardian request as scheduled, with a hash, and tells the student", async () => {
    fakeDb.user.findFirst.mockResolvedValue({ id: "stu", email: "stu@example.org" });
    expect(await actions.recordGuardianRequest(" Stu@Example.org ")).toEqual({ ok: true });
    const data = fakeDb.deletionRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: "stu", source: "guardian", status: "SCHEDULED", emailHash: hashEmail("stu@example.org", "test-secret") });
    expect(JSON.stringify(data)).not.toContain("example.org");
    expect(vi.mocked(notify).mock.calls[0][1][0]).toMatchObject({ userId: "stu", kind: "DELETION_SCHEDULED" });
  });
  it("validates the email and the account", async () => {
    expect(await actions.recordGuardianRequest("not an email")).toMatchObject({ ok: false });
    fakeDb.user.findFirst.mockResolvedValue(null);
    expect(await actions.recordGuardianRequest("who@example.org")).toMatchObject({ ok: false });
    expect(fakeDb.deletionRequest.create).not.toHaveBeenCalled();
  });
  it("cancels an open request and rejects a finished one", async () => {
    fakeDb.deletionRequest.findUnique.mockResolvedValue({ id: "req1", status: "SCHEDULED", source: "guardian", scheduledFor: new Date() });
    expect(await actions.adminCancelDeletion("req1")).toEqual({ ok: true });
    fakeDb.deletionRequest.findUnique.mockResolvedValue({ id: "req1", status: "COMPLETED", source: "self", scheduledFor: null });
    expect(await actions.adminCancelDeletion("req1")).toMatchObject({ ok: false });
  });
});
