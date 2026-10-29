import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyMock = vi.hoisted(() => vi.fn());
vi.mock("./index", () => ({ notify: notifyMock }));
const fakeDb = vi.hoisted(() => {
  const db = {
    studentProfile: { updateMany: vi.fn() },
    timelineEvent: { findMany: vi.fn() },
    notification: { findFirst: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { expireSnapshots, sendTimelineReminders } from "./daily";

const now = new Date("2027-02-10T12:00:00Z");
const day = 86_400_000;
const ev = (id: string, inDays: number, audience = "INCOMING") => ({ id, kind: "APPEAL_WINDOW", audience, label: "Spring window", opensAt: new Date(now.getTime() + inDays * day) });

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.notification.findFirst.mockResolvedValue(null);
  fakeDb.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
});

describe("expireSnapshots", () => {
  it("clears only self-reported grades and the honesty record past the expiry date", async () => {
    fakeDb.studentProfile.updateMany.mockResolvedValue({ count: 3 });
    expect(await expireSnapshots(now)).toBe(3);
    const call = fakeDb.studentProfile.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ snapshotExpiresAt: { lte: now } });
    expect(call.data).toEqual({ eighthMathGrade: null, scienceGrade: null, englishGrade: null, historyGrade: null, honestyConfirmedAt: null, snapshotExpiresAt: null });
  });
});

describe("sendTimelineReminders", () => {
  it("reminds the audience a week and a day before, once", async () => {
    fakeDb.timelineEvent.findMany.mockResolvedValue([ev("week", 7), ev("day", 1)]);
    expect(await sendTimelineReminders(now)).toBe(4);
    expect(notifyMock).toHaveBeenCalledTimes(2);
    const [, items] = notifyMock.mock.calls[0];
    expect(items[0]).toMatchObject({ userId: "u1", kind: "TIMELINE_REMINDER", data: { eventId: "week", days: 7 } });
    expect(notifyMock.mock.calls[1][1][0].data).toEqual({ eventId: "day", days: 1 });
  });
  it("targets the right roles for the date's audience", async () => {
    fakeDb.timelineEvent.findMany.mockResolvedValue([ev("w", 7, "INCOMING")]);
    await sendTimelineReminders(now);
    expect(fakeDb.user.findMany.mock.calls[0][0].where).toEqual({ role: { in: ["INCOMING"] } });
  });
  it("does not send twice for the same date and threshold", async () => {
    fakeDb.timelineEvent.findMany.mockResolvedValue([ev("week", 7)]);
    fakeDb.notification.findFirst.mockResolvedValue({ id: "already" });
    expect(await sendTimelineReminders(now)).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });
  it("is quiet for dates more than a week away or already past", async () => {
    fakeDb.timelineEvent.findMany.mockResolvedValue([]);
    expect(await sendTimelineReminders(now)).toBe(0);
  });
});
