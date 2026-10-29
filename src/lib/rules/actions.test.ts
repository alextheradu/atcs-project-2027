import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, UnauthenticatedError, assertRole, type SessionUser } from "@/lib/auth/guards";

const state = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("@/lib/auth", async () => {
  const guards = await import("@/lib/auth/guards");
  return {
    requireRole: async (...roles: Parameters<typeof guards.assertRole>[1][number][]) => guards.assertRole(state.user as never, roles),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

const fakeDb = vi.hoisted(() => {
  const m = () => ({ findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() });
  const db = { course: m(), courseEdge: m(), $transaction: vi.fn() };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
  return db;
});
vi.mock("@/lib/db", () => ({ db: fakeDb }));

import { writeAudit } from "@/lib/audit";
import * as actions from "./actions";

const make = (role: SessionUser["role"], departments: SessionUser["departments"] = []): SessionUser => ({
  id: "actor", role, departments, email: "actor@pascack.org", name: null,
});

const rule = { type: "completed", courses: ["algebra-i"] };
const edge = { fromId: "c1", toId: "c2", track: "MATH", kind: "STANDARD", appealable: true, note: null };

const all: [string, () => Promise<unknown>][] = [
  ["saveCourseRules", () => actions.saveCourseRules({ courseId: "c1", rules: rule })],
  ["createEdge", () => actions.createEdge(edge)],
  ["updateEdge", () => actions.updateEdge("e1", { kind: "ADVANCE", appealable: true, track: "MATH" })],
  ["deleteEdge", () => actions.deleteEdge("e1")],
];

beforeEach(() => {
  vi.clearAllMocks();
  state.user = null;
  fakeDb.$transaction.mockImplementation(async (cb: (tx: typeof fakeDb) => unknown) => cb(fakeDb));
  fakeDb.course.findUnique.mockResolvedValue({ id: "c1", slug: "geometry", department: "MATH", rules: null });
  fakeDb.course.findMany.mockImplementation(async (args: { where: { slug?: { in: string[] }; id?: { in: string[] } } }) =>
    args.where.slug ? args.where.slug.in.map((slug) => ({ slug })) : [{ id: "c1", department: "MATH" }, { id: "c2", department: "MATH" }],
  );
  fakeDb.courseEdge.findUnique.mockResolvedValue(null);
  fakeDb.courseEdge.findMany.mockResolvedValue([]);
  fakeDb.courseEdge.create.mockResolvedValue({ id: "e9", ...edge });
  fakeDb.courseEdge.update.mockResolvedValue({ id: "e1", ...edge });
});

describe("only admins and supervisors reach the rule and edge actions", () => {
  it.each(all)("%s rejects anonymous callers", async (_n, run) => {
    await expect(run()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
  for (const role of ["STUDENT", "INCOMING", "COUNSELOR"] as const) {
    it.each(all)(`%s rejects ${role}`, async (_n, run) => {
      state.user = make(role, ["MATH"]);
      await expect(run()).rejects.toBeInstanceOf(ForbiddenError);
      expect(fakeDb.course.update).not.toHaveBeenCalled();
      expect(fakeDb.courseEdge.create).not.toHaveBeenCalled();
    });
  }
  it("sanity: assertRole is the gate", () => {
    expect(() => assertRole(make("COUNSELOR"), ["ADMIN", "SUPERVISOR"])).toThrow(ForbiddenError);
  });
});

describe("supervisors stay inside their departments", () => {
  beforeEach(() => {
    state.user = make("SUPERVISOR", ["SCIENCE"]);
    fakeDb.courseEdge.findUnique.mockResolvedValue({ id: "e1", ...edge, from: { department: "MATH" }, to: { department: "MATH" } });
  });

  it("cannot save rules for another department, and nothing is written", async () => {
    await expect(actions.saveCourseRules({ courseId: "c1", rules: rule })).rejects.toBeInstanceOf(ForbiddenError);
    expect(fakeDb.course.update).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });
  it("cannot create, change or delete an edge between other departments' courses", async () => {
    fakeDb.courseEdge.findUnique.mockResolvedValue(null);
    await expect(actions.createEdge(edge)).rejects.toBeInstanceOf(ForbiddenError);
    fakeDb.courseEdge.findUnique.mockResolvedValue({ id: "e1", ...edge, from: { department: "MATH" }, to: { department: "MATH" } });
    await expect(actions.updateEdge("e1", { kind: "ADVANCE", appealable: true, track: "MATH" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(actions.deleteEdge("e1")).rejects.toBeInstanceOf(ForbiddenError);
    expect(fakeDb.courseEdge.create).not.toHaveBeenCalled();
    expect(fakeDb.courseEdge.update).not.toHaveBeenCalled();
    expect(fakeDb.courseEdge.delete).not.toHaveBeenCalled();
  });
  it("cannot wire a own-department course into another department's course", async () => {
    state.user = make("SUPERVISOR", ["MATH"]);
    fakeDb.course.findMany.mockResolvedValue([{ id: "c1", department: "MATH" }, { id: "c2", department: "SCIENCE" }]);
    await expect(actions.createEdge(edge)).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("can edit their own department, and it is audited", async () => {
    state.user = make("SUPERVISOR", ["MATH"]);
    expect(await actions.saveCourseRules({ courseId: "c1", rules: rule })).toEqual({ ok: true });
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "rules.updated", entityId: "c1" }), expect.anything());
  });
});

describe("saveCourseRules", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
  });
  it("saves, audits before and after, and clears with null", async () => {
    fakeDb.course.findUnique.mockResolvedValue({ id: "c1", slug: "geometry", department: "MATH", rules: { type: "manual", label: "x" } });
    expect((await actions.saveCourseRules({ courseId: "c1", rules: rule })).ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ before: { type: "manual", label: "x" }, after: rule }),
      expect.anything(),
    );
    expect((await actions.saveCourseRules({ courseId: "c1", rules: null })).ok).toBe(true);
  });
  it("rejects malformed rules and writes nothing", async () => {
    for (const rules of [{ type: "nope" }, { type: "completed", courses: [] }, { type: "minGrade", courses: ["a"], grade: "Z", basis: "final" }, "x", undefined]) {
      expect((await actions.saveCourseRules({ courseId: "c1", rules })).ok).toBe(false);
    }
    expect((await actions.saveCourseRules({ courseId: "../x", rules: null })).ok).toBe(false);
    expect((await actions.saveCourseRules(null)).ok).toBe(false);
    expect(fakeDb.course.update).not.toHaveBeenCalled();
  });
  it("rejects unknown courses and a course that requires itself", async () => {
    fakeDb.course.findMany.mockResolvedValue([]);
    const r = await actions.saveCourseRules({ courseId: "c1", rules: rule });
    expect(r).toEqual({ ok: false, error: "Unknown courses: algebra-i" });
    const self = await actions.saveCourseRules({ courseId: "c1", rules: { type: "completed", courses: ["geometry"] } });
    expect(self).toEqual({ ok: false, error: "A course cannot be its own prerequisite." });
  });
  it("fails cleanly for a missing course", async () => {
    fakeDb.course.findUnique.mockResolvedValue(null);
    expect((await actions.saveCourseRules({ courseId: "gone", rules: null })).ok).toBe(false);
  });
});

describe("edges", () => {
  beforeEach(() => {
    state.user = make("ADMIN");
  });
  it("creates and audits", async () => {
    expect((await actions.createEdge(edge)).ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "edge.created" }), expect.anything());
  });
  it("rejects duplicates, loops, self edges and bad input", async () => {
    fakeDb.courseEdge.findUnique.mockResolvedValue({ id: "x" });
    expect(await actions.createEdge(edge)).toEqual({ ok: false, error: "That step already exists." });
    fakeDb.courseEdge.findUnique.mockResolvedValue(null);
    fakeDb.courseEdge.findMany.mockResolvedValue([{ fromId: "c2", toId: "c1" }]);
    expect(await actions.createEdge(edge)).toEqual({ ok: false, error: "That step would make a loop." });
    fakeDb.courseEdge.findMany.mockResolvedValue([]);
    expect((await actions.createEdge({ ...edge, toId: "c1" })).ok).toBe(false);
    expect((await actions.createEdge({ ...edge, kind: "SIDEWAYS" })).ok).toBe(false);
    expect((await actions.createEdge({ ...edge, note: "x".repeat(301) })).ok).toBe(false);
    expect((await actions.createEdge(null)).ok).toBe(false);
    expect(fakeDb.courseEdge.create).not.toHaveBeenCalledTimes(2);
  });
  it("updates and deletes with an audit trail", async () => {
    fakeDb.courseEdge.findUnique.mockResolvedValue({ id: "e1", ...edge, from: { department: "MATH" }, to: { department: "MATH" } });
    expect((await actions.updateEdge("e1", { kind: "ADVANCE", appealable: false, track: "MATH" })).ok).toBe(true);
    expect((await actions.deleteEdge("e1")).ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "edge.updated" }), expect.anything());
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "edge.deleted" }), expect.anything());
  });
  it("reports a missing step", async () => {
    fakeDb.courseEdge.findUnique.mockResolvedValue(null);
    expect((await actions.deleteEdge("e1")).ok).toBe(false);
    expect((await actions.deleteEdge("../")).ok).toBe(false);
  });
});
