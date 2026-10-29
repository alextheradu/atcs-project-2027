import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() });
  const db = { deletionRequest: m(), user: m(), $transaction: vi.fn() };
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));
vi.mock("@/lib/deletion/erase", () => ({ eraseUser: vi.fn(async () => true) }));
vi.mock("@/lib/notify/index", () => ({ notify: vi.fn() }));

import { eraseUser } from "@/lib/deletion/erase";
import { processDueDeletions } from "@/lib/notify/daily";

const now = new Date("2026-12-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.deletionRequest.findMany.mockResolvedValue([{ id: "r1", userId: "u1" }]);
  fakeDb.deletionRequest.updateMany.mockResolvedValue({ count: 1 });
  fakeDb.user.findUnique.mockResolvedValue({ role: "STUDENT" });
});

describe("processDueDeletions", () => {
  it("only picks up scheduled requests whose date has passed", async () => {
    await processDueDeletions(now);
    expect(fakeDb.deletionRequest.findMany.mock.calls[0][0].where).toMatchObject({ status: "SCHEDULED", scheduledFor: { lte: now } });
  });
  it("marks the request completed first, then erases the user", async () => {
    expect(await processDueDeletions(now)).toBe(1);
    expect(fakeDb.deletionRequest.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "r1", status: "SCHEDULED" }, data: { status: "COMPLETED" } });
    expect(eraseUser).toHaveBeenCalledWith(fakeDb, "u1");
  });
  it("skips a request cancelled a moment ago", async () => {
    fakeDb.deletionRequest.updateMany.mockResolvedValue({ count: 0 });
    expect(await processDueDeletions(now)).toBe(0);
    expect(eraseUser).not.toHaveBeenCalled();
  });
  it("never deletes the last admin, and cancels that request", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    fakeDb.user.count.mockResolvedValue(0);
    expect(await processDueDeletions(now)).toBe(0);
    expect(eraseUser).not.toHaveBeenCalled();
    expect(fakeDb.deletionRequest.update.mock.calls[0][0].data).toMatchObject({ status: "CANCELLED", completedAt: null });
  });
  it("deletes an admin when another remains", async () => {
    fakeDb.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    fakeDb.user.count.mockResolvedValue(2);
    expect(await processDueDeletions(now)).toBe(1);
  });
});
