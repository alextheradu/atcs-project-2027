import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError, type SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("@/lib/auth", async () => {
  const guards = await import("@/lib/auth/guards");
  return {
    requireRole: async (...roles: Parameters<typeof guards.assertRole>[1][number][]) =>
      guards.assertRole(state.user as never, roles),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({
    findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn(),
    delete: vi.fn(), deleteMany: vi.fn(),
  });
  const db = {
    course: m(), courseRequirement: m(), courseAlias: m(), interestTag: m(), planEntry: m(), appeal: m(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import * as catalog from "./admin";

const user = (role: SessionUser["role"]): SessionUser => ({ id: "a", role, departments: [], email: "a@pascack.org", name: null });

const valid = {
  slug: "new-course", name: "New Course", department: "MATH", level: "CP", duration: "FULL", credits: 5,
  gradesOffered: [11], description: "A course.", prereqText: null, dualEnrollmentNote: null,
  dualEnrollment: false,
  hasApExam: false, plannable: true, sourcePage: null, requirements: [], interests: [],
};

const existing = {
  id: "c1", slug: "new-course", name: "Old", department: "MATH", level: "CP", duration: "FULL", credits: 5,
  gradesOffered: [11], description: "x", prereqText: null, dualEnrollmentNote: null, hasApExam: false,
  dualEnrollment: false,
  plannable: true, archived: false, sourcePage: null, requirements: [], interests: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  state.user = null;
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.course.findUnique.mockResolvedValue(null);
  fakeDb.course.create.mockResolvedValue({ ...existing, id: "c9" });
  fakeDb.course.update.mockResolvedValue({ ...existing, name: "New Course" });
  fakeDb.interestTag.findMany.mockResolvedValue([]);
  fakeDb.planEntry.count.mockResolvedValue(0);
  fakeDb.appeal.count.mockResolvedValue(0);
});

const actions: [string, () => Promise<unknown>][] = [
  ["createCourse", () => catalog.createCourse(valid)],
  ["updateCourse", () => catalog.updateCourse("c1", valid)],
  ["setCourseArchived", () => catalog.setCourseArchived("c1", true)],
  ["deleteCourse", () => catalog.deleteCourse("c1")],
  ["addAlias", () => catalog.addAlias({ courseId: "c1", alias: "Some Title" })],
  ["removeAlias", () => catalog.removeAlias("al1")],
  ["exportCatalogCsv", () => catalog.exportCatalogCsv()],
  ["importCatalogCsv", () => catalog.importCatalogCsv("slug\n")],
];

describe("catalog admin is COUNSELOR and ADMIN only", () => {
  it.each(actions)("%s rejects anonymous callers", async (_n, run) => {
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  for (const role of ["STUDENT", "INCOMING", "SUPERVISOR"] as const) {
    it.each(actions)(`%s rejects ${role}`, async (_n, run) => {
      state.user = user(role);
      await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
    });
  }
  for (const role of ["COUNSELOR", "ADMIN"] as const) {
    it.each(actions)(`%s allows ${role}`, async (_n, run) => {
      state.user = user(role);
      fakeDb.course.findUnique.mockImplementation(async (q: { where: { id?: string; slug?: string } }) =>
        q.where.id ? existing : null);
      fakeDb.courseAlias.findUnique.mockResolvedValue(null);
      fakeDb.course.findMany.mockResolvedValue([]);
      fakeDb.courseAlias.create.mockResolvedValue({ id: "al" });
      await expect(run()).resolves.toBeDefined();
    });
  }
  it("a rejected caller never touches the database", async () => {
    state.user = user("STUDENT");
    await expect(catalog.deleteCourse("c1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(fakeDb.course.findUnique).not.toHaveBeenCalled();
    expect(fakeDb.course.delete).not.toHaveBeenCalled();
  });
});

describe("createCourse", () => {
  beforeEach(() => {
    state.user = user("COUNSELOR");
  });
  it("creates and audits", async () => {
    const r = await catalog.createCourse(valid);
    expect(r.ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "course.created" }), expect.anything());
  });
  it("rejects a duplicate slug", async () => {
    fakeDb.course.findUnique.mockResolvedValue({ id: "x" });
    expect((await catalog.createCourse(valid)).ok).toBe(false);
    expect(fakeDb.course.create).not.toHaveBeenCalled();
  });
  it("rejects invalid input", async () => {
    for (const bad of [{ ...valid, slug: "Bad Slug" }, { ...valid, credits: 99 }, { ...valid, level: "GOD" }, { ...valid, duration: "HALF", credits: 5 }, null]) {
      expect((await catalog.createCourse(bad)).ok).toBe(false);
    }
  });
  it("rejects unknown interest tags", async () => {
    const r = await catalog.createCourse({ ...valid, interests: ["nope"] });
    expect(r.ok).toBe(false);
  });
  it("rejects a requirement tagged twice", async () => {
    const dup = { kind: "MATH", credits: 5, provisional: false };
    expect((await catalog.createCourse({ ...valid, requirements: [dup, dup] })).ok).toBe(false);
  });
});

describe("updateCourse", () => {
  beforeEach(() => {
    state.user = user("COUNSELOR");
    fakeDb.course.findUnique.mockImplementation(async (q: { where: { id?: string } }) => (q.where.id ? existing : null));
  });
  it("writes before and after to the audit log", async () => {
    await catalog.updateCourse("c1", valid);
    const call = vi.mocked(writeAudit).mock.calls[0][0];
    expect(call.action).toBe("course.updated");
    expect(call.before).toMatchObject({ name: "Old" });
    expect(call.after).toMatchObject({ name: "New Course" });
  });
  it.each([true, false])("saves dual enrollment %s independently of honors and audits it", async (dualEnrollment) => {
    const data = { ...valid, level: "HONORS", dualEnrollment, dualEnrollmentNote: "Partner college" };
    fakeDb.course.update.mockResolvedValue({ ...existing, ...data });
    expect((await catalog.updateCourse("c1", data)).ok).toBe(true);
    expect(fakeDb.course.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ level: "HONORS", dualEnrollment, dualEnrollmentNote: "Partner college" }),
    }));
    expect(vi.mocked(writeAudit).mock.calls[0][0].after).toMatchObject({ level: "HONORS", dualEnrollment });
  });
  it("replaces requirement tags", async () => {
    await catalog.updateCourse("c1", { ...valid, requirements: [{ kind: "MATH", credits: 5, provisional: false }] });
    expect(fakeDb.courseRequirement.deleteMany).toHaveBeenCalledWith({ where: { courseId: "c1" } });
  });
  it("does not allow changing the slug", async () => {
    const r = await catalog.updateCourse("c1", { ...valid, slug: "another" });
    expect(r.ok).toBe(false);
    expect(fakeDb.course.update).not.toHaveBeenCalled();
  });
});

describe("deleteCourse", () => {
  beforeEach(() => {
    state.user = user("ADMIN");
    fakeDb.course.findUnique.mockResolvedValue(existing);
  });
  it("is blocked when a plan entry references the course", async () => {
    fakeDb.planEntry.count.mockResolvedValue(3);
    const r = await catalog.deleteCourse("c1");
    expect(r.ok).toBe(false);
    expect(fakeDb.course.delete).not.toHaveBeenCalled();
  });
  it("is blocked when an appeal references the course", async () => {
    fakeDb.appeal.count.mockResolvedValue(1);
    expect((await catalog.deleteCourse("c1")).ok).toBe(false);
    expect(fakeDb.course.delete).not.toHaveBeenCalled();
  });
  it("deletes an unreferenced course and audits the before state", async () => {
    expect((await catalog.deleteCourse("c1")).ok).toBe(true);
    expect(fakeDb.course.delete).toHaveBeenCalled();
    expect(vi.mocked(writeAudit).mock.calls[0][0]).toMatchObject({ action: "course.deleted", before: { slug: "new-course" } });
  });
});

describe("archive and aliases", () => {
  beforeEach(() => {
    state.user = user("COUNSELOR");
  });
  it("archives instead of deleting", async () => {
    fakeDb.course.findUnique.mockResolvedValue(existing);
    expect((await catalog.setCourseArchived("c1", true)).ok).toBe(true);
    expect(fakeDb.course.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { archived: true } });
    expect(fakeDb.course.delete).not.toHaveBeenCalled();
  });
  it("stores aliases in normalized form", async () => {
    fakeDb.course.findUnique.mockResolvedValue(existing);
    fakeDb.courseAlias.findUnique.mockResolvedValue(null);
    fakeDb.courseAlias.create.mockResolvedValue({ id: "al" });
    await catalog.addAlias({ courseId: "c1", alias: "Hon. Eng I" });
    expect(fakeDb.courseAlias.create).toHaveBeenCalledWith({
      data: { alias: "honors english i", courseId: "c1", createdById: "a" },
    });
  });
  it("rejects an alias that already exists", async () => {
    fakeDb.course.findUnique.mockResolvedValue(existing);
    fakeDb.courseAlias.findUnique.mockResolvedValue({ id: "x" });
    expect((await catalog.addAlias({ courseId: "c1", alias: "Anything" })).ok).toBe(false);
  });
});

describe("importCatalogCsv", () => {
  beforeEach(() => {
    state.user = user("COUNSELOR");
  });
  const header = "slug,name,department,level,duration,credits,gradesOffered,description,prereqText,dualEnrollmentNote,hasApExam,plannable,archived,sourcePage,requirements,interests";
  const goodRow = "csv-course,CSV Course,MATH,CP,FULL,5,11|12,Desc,,,false,true,false,12,MATH:5:false,";
  const badRow = "bad slug,CSV Course,MATH,CP,FULL,5,11|12,Desc,,,false,true,false,12,,";

  it("imports valid rows", async () => {
    fakeDb.course.findUnique.mockResolvedValue(null);
    fakeDb.course.create.mockResolvedValue({ id: "n" });
    const r = await catalog.importCatalogCsv(`${header}\r\n${goodRow}\r\n`);
    expect(r).toMatchObject({ ok: true, data: { created: 1, updated: 0 } });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "catalog.csv_import" }), expect.anything());
  });
  it("is all or nothing when any row is invalid", async () => {
    const r = await catalog.importCatalogCsv(`${header}\r\n${goodRow}\r\n${badRow}\r\n`);
    expect(r.ok).toBe(false);
    expect(r.errors?.[0]).toMatch(/Row 3/);
    expect(fakeDb.course.create).not.toHaveBeenCalled();
    expect(fakeDb.$transaction).not.toHaveBeenCalled();
  });
  it("updates an existing slug", async () => {
    fakeDb.course.findUnique.mockResolvedValue({ id: "c1" });
    const r = await catalog.importCatalogCsv(`${header}\r\n${goodRow}\r\n`);
    expect(r).toMatchObject({ ok: true, data: { created: 0, updated: 1 } });
  });
  it("rejects duplicate slugs, oversized files, and non-strings", async () => {
    expect((await catalog.importCatalogCsv(`${header}\r\n${goodRow}\r\n${goodRow}\r\n`)).ok).toBe(false);
    expect((await catalog.importCatalogCsv("x".repeat(2 * 1024 * 1024 + 1))).ok).toBe(false);
    expect((await catalog.importCatalogCsv(42)).ok).toBe(false);
    expect((await catalog.importCatalogCsv("")).ok).toBe(false);
  });
});
