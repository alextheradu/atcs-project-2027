import { describe, expect, it, vi } from "vitest";
import { notify } from "./index";

function tx(prefs: { userId: string; kind: string; inApp: boolean; email: boolean; push: boolean }[] = []) {
  let n = 0;
  return {
    notificationPreference: { findMany: vi.fn().mockResolvedValue(prefs) },
    notification: { createManyAndReturn: vi.fn(async ({ data }: { data: { userId: string; kind: string; title?: string; body?: string }[] }) => data.map((d) => ({ id: `n${++n}`, userId: d.userId, kind: d.kind }))) },
    notificationDelivery: { createMany: vi.fn() },
  };
}
const item = (userId: string, kind: string) => ({ userId, kind: kind as never, title: "t", body: "b", url: "/x" });

describe("notify", () => {
  it("does nothing for an empty list", async () => {
    const t = tx();
    await notify(t as never, []);
    expect(t.notification.createManyAndReturn).not.toHaveBeenCalled();
  });
  it("always records the in-app notification, and queues email only for decisions by default", async () => {
    const t = tx();
    await notify(t as never, [item("u1", "APPEAL_DECIDED"), item("u2", "PLAN_COMMENT")]);
    expect(t.notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(t.notificationDelivery.createMany).toHaveBeenCalledWith({ data: [{ notificationId: "n1", channel: "EMAIL" }] });
  });
  it("respects saved preferences per user and kind", async () => {
    const t = tx([{ userId: "u2", kind: "PLAN_COMMENT", inApp: true, email: true, push: true }, { userId: "u1", kind: "APPEAL_DECIDED", inApp: true, email: false, push: false }]);
    await notify(t as never, [item("u1", "APPEAL_DECIDED"), item("u2", "PLAN_COMMENT")]);
    expect(t.notificationDelivery.createMany).toHaveBeenCalledWith({ data: [{ notificationId: "n2", channel: "EMAIL" }, { notificationId: "n2", channel: "PUSH" }] });
  });
  it("queues no deliveries when nobody wants any", async () => {
    const t = tx();
    await notify(t as never, [item("u1", "PLAN_COMMENT")]);
    expect(t.notificationDelivery.createMany).not.toHaveBeenCalled();
  });
  it("trims long titles and bodies", async () => {
    const t = tx();
    await notify(t as never, [{ ...item("u1", "SYSTEM"), title: "t".repeat(500), body: "b".repeat(900) }]);
    const row = t.notification.createManyAndReturn.mock.calls[0][0].data[0] as { title: string; body: string };
    expect(row.title.length).toBe(120);
    expect(row.body.length).toBe(300);
  });
});
