import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthenticatedError } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", () => ({
  requireUser: async () => {
    const { UnauthenticatedError } = await import("@/lib/auth/guards");
    if (!state.user) throw new UnauthenticatedError();
    return state.user;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const fakeDb = vi.hoisted(() => {
  const db = {
    notification: { updateMany: vi.fn() },
    notificationPreference: { upsert: vi.fn((a: unknown) => a) },
    pushSubscription: { count: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import * as actions from "./actions";

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "p".repeat(40), auth: "a".repeat(20) };

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "u1", role: "STUDENT", departments: [], email: "u@x.org", name: null };
  fakeDb.pushSubscription.count.mockResolvedValue(0);
  fakeDb.pushSubscription.findUnique.mockResolvedValue(null);
});

describe("notifications are private", () => {
  it("needs a signed in user", async () => {
    state.user = null;
    await expect(actions.markRead("n1")).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(actions.savePreferences([])).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(actions.savePushSubscription(sub)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  it("marks read only the caller's own notifications", async () => {
    await actions.markRead("n1");
    expect(fakeDb.notification.updateMany).toHaveBeenCalledWith({ where: { id: "n1", userId: "u1", readAt: null }, data: { readAt: expect.any(Date) } });
    await actions.markRead("../x");
    expect(fakeDb.notification.updateMany).toHaveBeenCalledTimes(1);
    await actions.markAllRead();
    expect(fakeDb.notification.updateMany.mock.calls[1][0].where).toEqual({ userId: "u1", readAt: null });
  });
});

describe("savePreferences", () => {
  it("saves per kind for the caller and keeps in app on", async () => {
    expect(await actions.savePreferences([{ kind: "PLAN_COMMENT", inApp: false, email: true, push: true }])).toEqual({ ok: true });
    const call = fakeDb.notificationPreference.upsert.mock.calls[0][0] as { where: unknown; update: unknown };
    expect(call.where).toEqual({ userId_kind: { userId: "u1", kind: "PLAN_COMMENT" } });
    expect(call.update).toEqual({ inApp: true, email: true, push: true });
  });
  it("cannot switch off account safety email", async () => {
    await actions.savePreferences([{ kind: "DELETION_CONFIRM", inApp: true, email: false, push: false }]);
    expect((fakeDb.notificationPreference.upsert.mock.calls[0][0] as { update: { email: boolean } }).update.email).toBe(true);
  });
  it("rejects unknown kinds and malformed input", async () => {
    expect((await actions.savePreferences([{ kind: "NOPE", inApp: true, email: true, push: true }])).ok).toBe(false);
    expect((await actions.savePreferences("x")).ok).toBe(false);
    expect(fakeDb.$transaction).not.toHaveBeenCalled();
  });
});

describe("push subscriptions", () => {
  it("stores a valid https subscription for the caller", async () => {
    expect((await actions.savePushSubscription(sub)).ok).toBe(true);
    expect(fakeDb.pushSubscription.upsert.mock.calls[0][0].create).toMatchObject({ userId: "u1", endpoint: sub.endpoint });
  });
  it("rejects non-https endpoints, junk and oversized values", async () => {
    for (const bad of [{ ...sub, endpoint: "http://fcm.googleapis.com/a" }, { ...sub, endpoint: "https://169.254.169.254/latest" }, { ...sub, endpoint: "https://fcm.googleapis.com.evil.com/x" }, { ...sub, endpoint: "not a url" }, { ...sub, p256dh: "x" }, { ...sub, endpoint: `https://fcm.googleapis.com/${"a".repeat(700)}` }, null]) {
      expect((await actions.savePushSubscription(bad)).ok).toBe(false);
    }
    expect(fakeDb.pushSubscription.upsert).not.toHaveBeenCalled();
  });
  it("limits devices per user, but lets an existing device refresh", async () => {
    fakeDb.pushSubscription.count.mockResolvedValue(10);
    expect((await actions.savePushSubscription(sub)).ok).toBe(false);
    fakeDb.pushSubscription.findUnique.mockResolvedValue({ id: "s" });
    expect((await actions.savePushSubscription(sub)).ok).toBe(true);
  });
  it("removes only the caller's own device", async () => {
    await actions.removePushSubscription(sub.endpoint);
    expect(fakeDb.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: sub.endpoint, userId: "u1" } });
  });
});
