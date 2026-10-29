import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn(), setVapid: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: send.email }; } }));
vi.mock("web-push", () => ({ default: { setVapidDetails: send.setVapid, sendNotification: send.push } }));
const fakeDb = vi.hoisted(() => {
  const db = {
    notificationDelivery: { findUnique: vi.fn(), update: vi.fn() },
    pushSubscription: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { processDelivery } from "./deliver";

const row = (channel: "EMAIL" | "PUSH", more = {}, subs: { endpoint: string; p256dh: string; auth: string }[] = []) => ({
  id: "d1", channel, status: "PENDING", attempts: 0,
  notification: { title: "Approved", body: "Your request was approved.", url: "/appeals/1", user: { email: "student@pascack.org", pushSubscriptions: subs } },
  ...more,
});
const now = new Date("2027-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Planner <noreply@example.com>";
  process.env.VAPID_PUBLIC_KEY = "pub-key";
  process.env.VAPID_PRIVATE_KEY = "priv-key";
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
});

describe("email deliveries", () => {
  it("sends and marks the delivery sent", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL"));
    send.email.mockResolvedValue({ data: { id: "x" }, error: null });
    expect(await processDelivery("d1", now)).toMatchObject({ status: "SENT" });
    expect(send.email).toHaveBeenCalledWith(expect.objectContaining({ to: "student@pascack.org", subject: "Approved" }));
    expect(fakeDb.notificationDelivery.update.mock.calls[0][0].data).toMatchObject({ status: "SENT", attempts: 1, sentAt: now });
  });
  it("retries a transient failure and records the attempt", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL"));
    send.email.mockRejectedValue(new Error("network down"));
    const o = await processDelivery("d1", now);
    expect(o).toMatchObject({ status: "PENDING", lastError: "network down" });
    const data = fakeDb.notificationDelivery.update.mock.calls[0][0].data;
    expect(data.attempts).toBe(1);
    expect(data.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
  });
  it("stops after the fifth failed attempt", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL", { attempts: 4 }));
    send.email.mockRejectedValue(new Error("still down"));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "FAILED" });
  });
  it("fails at once, without retrying, when email is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL"));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "FAILED", lastError: "email is not configured" });
    expect(send.email).not.toHaveBeenCalled();
  });
  it("never logs the full address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL"));
    send.email.mockRejectedValue(new Error("boom"));
    await processDelivery("d1", now);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("student@pascack.org");
    warn.mockRestore();
  });
  it("does not resend a delivery that is already done", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("EMAIL", { status: "SENT" }));
    expect(await processDelivery("d1", now)).toBeNull();
    expect(send.email).not.toHaveBeenCalled();
  });
});

describe("push deliveries", () => {
  const subs = [{ endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "k".repeat(20), auth: "s".repeat(20) }, { endpoint: "https://fcm.googleapis.com/fcm/send/b", p256dh: "k".repeat(20), auth: "s".repeat(20) }];

  it("removes a subscription that answers 410 and still counts a good one as sent", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, subs));
    send.push.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/b")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    });
    expect(await processDelivery("d1", now)).toMatchObject({ status: "SENT", deleteEndpoints: ["https://fcm.googleapis.com/fcm/send/b"] });
    expect(fakeDb.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: ["https://fcm.googleapis.com/fcm/send/b"] } } });
  });
  it("removes a subscription on 404 and skips when none is left", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, [subs[0]]));
    send.push.mockRejectedValue(Object.assign(new Error("not found"), { statusCode: 404 }));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "SKIPPED" });
    expect(fakeDb.pushSubscription.deleteMany).toHaveBeenCalled();
  });
  it("retries other failures and keeps the subscription", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, [subs[0]]));
    send.push.mockRejectedValue(Object.assign(new Error("server error"), { statusCode: 503 }));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "PENDING" });
    expect(fakeDb.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
  it("never calls an endpoint outside the push services, and removes it", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, [{ endpoint: "http://169.254.169.254/latest", p256dh: "k".repeat(20), auth: "s".repeat(20) }, { endpoint: "https://internal.corp/x", p256dh: "k".repeat(20), auth: "s".repeat(20) }]));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "SKIPPED", deleteEndpoints: ["http://169.254.169.254/latest", "https://internal.corp/x"] });
    expect(send.push).not.toHaveBeenCalled();
  });
  it("skips a user with no device, sends a short payload with a local link", async () => {
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, []));
    expect(await processDelivery("d1", now)).toMatchObject({ status: "SKIPPED" });
    fakeDb.notificationDelivery.findUnique.mockResolvedValue(row("PUSH", {}, [subs[0]]));
    send.push.mockResolvedValue(undefined);
    await processDelivery("d1", now);
    expect(JSON.parse(send.push.mock.calls[0][1])).toEqual({ title: "Approved", body: "Your request was approved.", url: "/appeals/1" });
  });
});
