import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError, assertRole } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => (await import("@/lib/auth/guards")).assertRole(state.user as never, roles as never) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), create: vi.fn(), update: vi.fn() });
  const db = { importRequest: m(), courseAlias: m(), course: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import * as req from "./requests";

const make = (role: string) => ({ id: "s", role, departments: [], email: "s@x.org", name: null });
const pending = { id: "r1", status: "PENDING", normalizedTitle: "brand new course", courseId: null };

beforeEach(() => {
  vi.clearAllMocks();
  state.user = make("COUNSELOR");
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.importRequest.findUnique.mockResolvedValue(pending);
  fakeDb.course.findUnique.mockResolvedValue({ id: "c1" });
  fakeDb.courseAlias.findUnique.mockResolvedValue(null);
});

describe("only counselors and admins review requests", () => {
  const calls: [string, () => Promise<unknown>][] = [["approve", () => req.approveImportRequest("r1", "c1")], ["dismiss", () => req.dismissImportRequest("r1")]];
  it.each(calls)("%s rejects anonymous callers", async (_n, run) => {
    state.user = null;
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  for (const role of ["STUDENT", "INCOMING", "SUPERVISOR"]) {
    it.each(calls)(`%s rejects ${role}`, async (_n, run) => {
      state.user = make(role);
      await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
      expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
    });
  }
  it("sanity", () => expect(() => assertRole(make("STUDENT") as never, ["COUNSELOR", "ADMIN"])).toThrow(ForbiddenError));
});

describe("approveImportRequest", () => {
  it("creates the shared alias, marks the request, and audits", async () => {
    expect(await req.approveImportRequest("r1", "c1")).toEqual({ ok: true });
    expect(fakeDb.courseAlias.create).toHaveBeenCalledWith({ data: { alias: "brand new course", courseId: "c1", createdById: "s" } });
    expect(fakeDb.importRequest.update.mock.calls[0][0].data).toMatchObject({ status: "APPROVED", courseId: "c1" });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "import_request.approved" }), expect.anything());
  });
  it("uses the student's suggested course when none is chosen", async () => {
    fakeDb.importRequest.findUnique.mockResolvedValue({ ...pending, courseId: "c1" });
    expect((await req.approveImportRequest("r1")).ok).toBe(true);
  });
  it("needs a course when the title was missing from the catalog", async () => {
    expect(await req.approveImportRequest("r1")).toMatchObject({ ok: false });
    expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
  });
  it("does not overwrite an existing alias, and cannot approve twice", async () => {
    fakeDb.courseAlias.findUnique.mockResolvedValue({ id: "a" });
    await req.approveImportRequest("r1", "c1");
    expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
    fakeDb.importRequest.findUnique.mockResolvedValue({ ...pending, status: "APPROVED" });
    expect(await req.approveImportRequest("r1", "c1")).toMatchObject({ ok: false });
  });
  it("rejects bad ids and unknown courses", async () => {
    expect((await req.approveImportRequest("../x", "c1")).ok).toBe(false);
    fakeDb.course.findUnique.mockResolvedValue(null);
    expect((await req.approveImportRequest("r1", "nope")).ok).toBe(false);
  });
});

describe("dismissImportRequest", () => {
  it("marks it dismissed and audits, creating no alias", async () => {
    expect(await req.dismissImportRequest("r1")).toEqual({ ok: true });
    expect(fakeDb.importRequest.update.mock.calls[0][0].data.status).toBe("DISMISSED");
    expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
  });
});
