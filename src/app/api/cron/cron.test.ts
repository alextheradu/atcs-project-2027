import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deliver = vi.hoisted(() => ({ claimDue: vi.fn(), processDelivery: vi.fn() }));
const daily = vi.hoisted(() => ({ expireSnapshots: vi.fn(), processDueDeletions: vi.fn(), sendTimelineReminders: vi.fn() }));
vi.mock("@/lib/notify/deliver", () => deliver);
vi.mock("@/lib/notify/daily", () => daily);

import { POST as postDaily } from "./daily/route";
import { POST as postDeliver } from "./deliver/route";

const SECRET = "a-very-long-cron-secret-value";
const req = (auth?: string) => new NextRequest("http://localhost/api/cron/x", { method: "POST", headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  deliver.claimDue.mockResolvedValue([]);
  daily.expireSnapshots.mockResolvedValue(2);
  daily.processDueDeletions.mockResolvedValue(0);
  daily.sendTimelineReminders.mockResolvedValue(5);
});

describe("cron routes are unreachable without the secret", () => {
  for (const [name, post] of [["deliver", postDeliver], ["daily", postDaily]] as const) {
    it(`${name} rejects a missing or wrong secret and does no work`, async () => {
      for (const h of [undefined, "Bearer nope", `Bearer ${SECRET}x`, SECRET]) expect((await post(req(h))).status).toBe(401);
      expect(deliver.claimDue).not.toHaveBeenCalled();
      expect(daily.expireSnapshots).not.toHaveBeenCalled();
    });
    it(`${name} rejects everything when CRON_SECRET is unset`, async () => {
      delete process.env.CRON_SECRET;
      expect((await post(req("Bearer "))).status).toBe(401);
      expect((await post(req("Bearer undefined"))).status).toBe(401);
    });
  }
});

describe("deliver", () => {
  it("processes each claimed row and reports totals", async () => {
    deliver.claimDue.mockResolvedValue(["a", "b", "c", "d"]);
    deliver.processDelivery.mockResolvedValueOnce({ status: "SENT" }).mockResolvedValueOnce({ status: "PENDING" }).mockResolvedValueOnce({ status: "FAILED" }).mockResolvedValueOnce({ status: "SKIPPED" });
    const r = await postDeliver(req(`Bearer ${SECRET}`));
    expect(await r.json()).toEqual({ claimed: 4, sent: 1, retry: 1, failed: 1, skipped: 1 });
  });
  it("ignores a row another worker finished first", async () => {
    deliver.claimDue.mockResolvedValue(["a"]);
    deliver.processDelivery.mockResolvedValue(null);
    expect(await (await postDeliver(req(`Bearer ${SECRET}`))).json()).toEqual({ claimed: 1, sent: 0, retry: 0, failed: 0, skipped: 0 });
  });
});

describe("daily", () => {
  it("runs the three jobs", async () => {
    expect(await (await postDaily(req(`Bearer ${SECRET}`))).json()).toEqual({ snapshotsExpired: 2, deletionsProcessed: 0, remindersQueued: 5 });
  });
});
