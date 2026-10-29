"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ruleSchema, ruleSlugs } from "@/lib/eligibility";
import { Prisma } from "@/generated/prisma/client";
import { canEditDepartment, canEditEdge, wouldCycle } from "./scope";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

const editor = () => requireRole("ADMIN", "SUPERVISOR");
const id = z.string().regex(/^[a-z0-9]{1,64}$/i, "Invalid id.");

const rulesInput = z.object({ courseId: id, rules: ruleSchema.nullable() });

/** Save a course's rule tree. `null` clears it, which leaves the catalog text as a plain note. */
export async function saveCourseRules(input: unknown): Promise<ActionResult> {
  const actor = await editor();
  const parsed = rulesInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid rule.");
  const { courseId, rules } = parsed.data;

  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true, department: true, rules: true } });
  if (!course) return fail("Course not found.");
  // The scope check is the authorization. Hiding the page is only a convenience.
  if (!canEditDepartment(actor, course.department)) throw new ForbiddenError();

  if (rules) {
    const slugs = [...new Set(ruleSlugs(rules))];
    if (slugs.includes(course.slug)) return fail("A course cannot be its own prerequisite.");
    if (slugs.length) {
      const found = await db.course.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
      const have = new Set(found.map((c) => c.slug));
      const unknown = slugs.filter((s) => !have.has(s));
      if (unknown.length) return fail(`Unknown courses: ${unknown.join(", ")}`);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.course.update({ where: { id: courseId }, data: { rules: rules ? (rules as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
    await writeAudit(
      {
        actor,
        action: "rules.updated",
        entityType: "Course",
        entityId: courseId,
        before: (course.rules ?? null) as Prisma.InputJsonValue | null,
        after: (rules ?? null) as Prisma.InputJsonValue | null,
      },
      tx,
    );
  });
  revalidatePath("/admin/rules");
  revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/pathways");
  return { ok: true };
}

const TRACKS = ["MATH", "SCIENCE", "COMPUTER_SCIENCE", "WORLD_LANGUAGE", "ENGLISH", "SOCIAL_STUDIES"] as const;
const edgeInput = z.object({
  fromId: id,
  toId: id,
  track: z.enum(TRACKS),
  kind: z.enum(["STANDARD", "ADVANCE"]),
  appealable: z.boolean(),
  note: z.string().trim().max(300).nullable().optional(),
});

const edgeSnapshot = (e: { fromId: string; toId: string; track: string; kind: string; appealable: boolean; note: string | null }) => ({
  fromId: e.fromId, toId: e.toId, track: e.track, kind: e.kind, appealable: e.appealable, note: e.note,
});

async function endpoints(fromId: string, toId: string) {
  const rows = await db.course.findMany({ where: { id: { in: [fromId, toId] } }, select: { id: true, department: true } });
  const from = rows.find((r) => r.id === fromId);
  const to = rows.find((r) => r.id === toId);
  return from && to ? { from, to } : null;
}

export async function createEdge(input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await editor();
  const parsed = edgeInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid pathway step.");
  const e = parsed.data;

  const ends = await endpoints(e.fromId, e.toId);
  if (!ends) return fail("Course not found.");
  if (!canEditEdge(actor, ends.from.department, ends.to.department)) throw new ForbiddenError();

  if (await db.courseEdge.findUnique({ where: { fromId_toId: { fromId: e.fromId, toId: e.toId } }, select: { id: true } })) {
    return fail("That step already exists.");
  }
  const all = await db.courseEdge.findMany({ select: { fromId: true, toId: true } });
  if (wouldCycle(all.map((x) => ({ from: x.fromId, to: x.toId })), e.fromId, e.toId)) return fail("That step would make a loop.");

  const created = await db.$transaction(async (tx) => {
    const row = await tx.courseEdge.create({ data: { ...e, note: e.note || null } });
    await writeAudit({ actor, action: "edge.created", entityType: "CourseEdge", entityId: row.id, after: edgeSnapshot(row) }, tx);
    return row;
  });
  revalidatePath("/admin/edges");
  revalidatePath("/pathways");
  return { ok: true, data: { id: created.id } };
}

const edgePatch = edgeInput.pick({ kind: true, appealable: true, note: true, track: true });

export async function updateEdge(edgeId: unknown, input: unknown): Promise<ActionResult> {
  const actor = await editor();
  const idOk = id.safeParse(edgeId);
  const parsed = edgePatch.safeParse(input);
  if (!idOk.success || !parsed.success) return fail("Invalid pathway step.");

  const edge = await db.courseEdge.findUnique({ where: { id: idOk.data }, include: { from: { select: { department: true } }, to: { select: { department: true } } } });
  if (!edge) return fail("Step not found.");
  if (!canEditEdge(actor, edge.from.department, edge.to.department)) throw new ForbiddenError();

  await db.$transaction(async (tx) => {
    const row = await tx.courseEdge.update({ where: { id: edge.id }, data: { ...parsed.data, note: parsed.data.note || null } });
    await writeAudit({ actor, action: "edge.updated", entityType: "CourseEdge", entityId: edge.id, before: edgeSnapshot(edge), after: edgeSnapshot(row) }, tx);
  });
  revalidatePath("/admin/edges");
  revalidatePath("/pathways");
  return { ok: true };
}

export async function deleteEdge(edgeId: unknown): Promise<ActionResult> {
  const actor = await editor();
  const idOk = id.safeParse(edgeId);
  if (!idOk.success) return fail("Invalid pathway step.");

  const edge = await db.courseEdge.findUnique({ where: { id: idOk.data }, include: { from: { select: { department: true } }, to: { select: { department: true } } } });
  if (!edge) return fail("Step not found.");
  if (!canEditEdge(actor, edge.from.department, edge.to.department)) throw new ForbiddenError();

  await db.$transaction(async (tx) => {
    await tx.courseEdge.delete({ where: { id: edge.id } });
    await writeAudit({ actor, action: "edge.deleted", entityType: "CourseEdge", entityId: edge.id, before: edgeSnapshot(edge) }, tx);
  });
  revalidatePath("/admin/edges");
  revalidatePath("/pathways");
  return { ok: true };
}
