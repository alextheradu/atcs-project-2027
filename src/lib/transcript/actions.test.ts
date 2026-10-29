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
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() });
  const db = { plan: m(), course: m(), planEntry: m(), courseAlias: m(), importRequest: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import * as actions from "./actions";

let n = 0;
const user = { id: "u1", role: "STUDENT", departments: [], email: "u@x.org", name: null };
const row = (courseId: string, more = {}) => ({ courseId, gradeLevel: 9, status: "COMPLETED", grade: "A", credits: 5, ...more });

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { ...user, id: `u${++n}` };
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.plan.findFirst.mockResolvedValue({ id: "p1", status: "DRAFT" });
  fakeDb.course.findMany.mockImplementation(async (a: { where: { id: { in: string[] } } }) =>
    a.where.id.in.map((id) => ({ id, name: `Course ${id}`, credits: 5, plannable: id !== "ms" })),
  );
  fakeDb.planEntry.findMany.mockResolvedValue([]);
  fakeDb.courseAlias.findUnique.mockResolvedValue(null);
  fakeDb.importRequest.findUnique.mockResolvedValue(null);
  fakeDb.course.findMany.mockImplementation(async (a: { where?: { id: { in: string[] } } }) =>
    a.where ? a.where.id.in.map((id) => ({ id, name: `Course ${id}`, credits: 5, plannable: id !== "ms" })) : [{ name: "English I" }],
  );
});

describe("confirmImport", () => {
  it("needs a signed in user", async () => {
    state.user = null;
    await expect(actions.confirmImport({ planId: "p1", rows: [row("c1")] })).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("looks the plan up by owner, so another student's plan is not found", async () => {
    fakeDb.plan.findFirst.mockResolvedValue(null);
    const r = await actions.confirmImport({ planId: "theirs", rows: [row("c1")] });
    expect(r).toEqual({ ok: false, error: "Plan not found." });
    expect(fakeDb.plan.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "theirs", ownerId: (state.user as { id: string }).id } }));
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });

  it("refuses a submitted plan", async () => {
    fakeDb.plan.findFirst.mockResolvedValue({ id: "p1", status: "SUBMITTED" });
    expect((await actions.confirmImport({ planId: "p1", rows: [row("c1")] })).ok).toBe(false);
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });

  it("rejects oversized or malformed payloads before touching the database", async () => {
    const many = Array.from({ length: 61 }, (_, i) => row(`c${i}`));
    for (const bad of [
      { planId: "p1", rows: many },
      { planId: "p1", rows: [] },
      { planId: "p1", rows: [row("c1", { gradeLevel: 13 })] },
      { planId: "p1", rows: [row("c1", { grade: "Z" })] },
      { planId: "p1", rows: [row("c1", { credits: 99 })] },
      { planId: "p1", rows: [row("c1")], suggestions: [{ title: "x".repeat(500), courseId: "c1" }] },
      null,
    ]) {
      expect((await actions.confirmImport(bad)).ok).toBe(false);
    }
    expect(fakeDb.plan.findFirst).not.toHaveBeenCalled();
  });

  it("saves entries as IMPORT with the printed credits, and takes catalog credits for in progress rows", async () => {
    const r = await actions.confirmImport({
      planId: "p1",
      rows: [row("c1", { credits: 6, grade: "B_PLUS" }), row("c2", { status: "IN_PROGRESS", grade: null, credits: null, gradeLevel: 11 })],
    });
    expect(r).toEqual({ ok: true, data: { added: 2, skipped: [], sentToStaff: 0 } });
    const [a, b] = fakeDb.planEntry.create.mock.calls.map((c) => c[0].data);
    expect(a).toMatchObject({ courseId: "c1", source: "IMPORT", status: "COMPLETED", grade: "B_PLUS", credits: 6 });
    expect(b).toMatchObject({ courseId: "c2", source: "IMPORT", status: "IN_PROGRESS", grade: null, credits: 5 });
  });

  it("skips courses already on the plan or repeated, and never duplicates", async () => {
    fakeDb.planEntry.findMany.mockResolvedValue([{ courseId: "c1" }]);
    const r = await actions.confirmImport({ planId: "p1", rows: [row("c1"), row("c2"), row("c2")] });
    expect(r).toMatchObject({ ok: true, data: { added: 1, skipped: ["Course c1", "Course c2"] } });
  });

  it("will not import a middle school placeholder", async () => {
    expect((await actions.confirmImport({ planId: "p1", rows: [row("ms")] })).ok).toBe(false);
  });

  it("keeps the plan within its size limit", async () => {
    fakeDb.planEntry.findMany.mockResolvedValue(Array.from({ length: 59 }, (_, i) => ({ courseId: `x${i}` })));
    expect((await actions.confirmImport({ planId: "p1", rows: [row("c1"), row("c2")] })).ok).toBe(false);
  });

  it("never writes the shared alias table from a student import", async () => {
    await actions.confirmImport({
      planId: "p1", rows: [row("c1")],
      suggestions: [{ title: "Hon Eng III Class/Contemp Lit", courseId: "c1" }], missing: [{ title: "Brand New Course" }],
    });
    expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
  });

  it("sends a hand match and a missing course to staff as pending requests", async () => {
    const r = await actions.confirmImport({
      planId: "p1", rows: [row("c1")],
      suggestions: [{ title: "Hon Eng III Class/Contemp Lit", courseId: "c1" }], missing: [{ title: "Brand New Course" }],
    });
    expect(r).toMatchObject({ ok: true, data: { added: 1, sentToStaff: 2 } });
    const [a, b] = fakeDb.importRequest.create.mock.calls.map((c) => c[0].data);
    expect(a).toMatchObject({ normalizedTitle: "honors english iii class contemp lit", courseId: "c1" });
    expect(b).toMatchObject({ normalizedTitle: "brand new course", courseId: null });
    expect(a.studentId).toBe((state.user as { id: string }).id);
  });

  it("a missing course alone is enough to submit, and adds nothing to the plan", async () => {
    const r = await actions.confirmImport({ planId: "p1", rows: [], missing: [{ title: "Brand New Course" }] });
    expect(r).toMatchObject({ ok: true, data: { added: 0, sentToStaff: 1 } });
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });

  it("does not ask twice for the same title, or for one that already has an alias", async () => {
    fakeDb.importRequest.findUnique.mockResolvedValueOnce({ id: "r" });
    fakeDb.courseAlias.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "a" });
    const r = await actions.confirmImport({ planId: "p1", rows: [], missing: [{ title: "Seen Before" }, { title: "Has Alias" }] });
    expect(r).toMatchObject({ data: { sentToStaff: 0 } });
    expect(fakeDb.importRequest.create).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    for (let i = 0; i < 10; i++) await actions.confirmImport({ planId: "p1", rows: [row("c1")] });
    const r = await actions.confirmImport({ planId: "p1", rows: [row("c1")] });
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("too quickly");
  });

  it("keeps titles and grades out of the audit log", async () => {
    await actions.confirmImport({ planId: "p1", rows: [row("c1")] });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "plan.import", after: { added: 1, requests: 0 } }), expect.anything());
  });
});

describe("request safety", () => {
  it("refuses staff roles", async () => {
    state.user = { ...user, id: "staff", role: "COUNSELOR" };
    expect((await actions.confirmImport({ planId: "p1", rows: [row("c1")] })).ok).toBe(false);
    expect(fakeDb.planEntry.create).not.toHaveBeenCalled();
  });
  it("ignores a suggestion that points at a course not in the import", async () => {
    const r = await actions.confirmImport({ planId: "p1", rows: [row("c1")], suggestions: [{ title: "Free Money Course", courseId: "c9" }] });
    expect(r).toMatchObject({ ok: true, data: { sentToStaff: 0 } });
    expect(fakeDb.importRequest.create).not.toHaveBeenCalled();
  });
  it("never files a request for a title that is already a catalog course name", async () => {
    const r = await actions.confirmImport({ planId: "p1", rows: [row("c1")], suggestions: [{ title: "English I", courseId: "c1" }] });
    expect(r).toMatchObject({ ok: true, data: { sentToStaff: 0 } });
  });
});

describe("bulkAddCourses", () => {
  it("saves as MANUAL and never writes aliases", async () => {
    const r = await actions.bulkAddCourses({ planId: "p1", rows: [row("c1", { status: "PLANNED", grade: null, credits: null })], suggestions: [{ title: "Whatever", courseId: "c1" }] });
    expect(r).toMatchObject({ ok: true, data: { added: 1, sentToStaff: 0 } });
    expect(fakeDb.planEntry.create.mock.calls[0][0].data.source).toBe("MANUAL");
    expect(fakeDb.courseAlias.create).not.toHaveBeenCalled();
  });
});
