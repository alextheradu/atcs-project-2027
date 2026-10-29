"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const id = z.string().regex(/^[a-z0-9]{1,64}$/i);

/**
 * Staff only. Approving turns a student's request into a shared alias, so later imports match on
 * their own. For a title that was missing from the catalog, staff pick the course it really is
 * (or add the course first, then come back). Nothing a student sends reaches the shared aliases
 * without this step.
 */
export async function approveImportRequest(requestId: unknown, courseId?: unknown): Promise<ActionResult> {
  const actor = await requireRole("COUNSELOR", "ADMIN");
  const rid = id.safeParse(requestId);
  if (!rid.success) return fail("Invalid request.");
  const req = await db.importRequest.findUnique({ where: { id: rid.data } });
  if (!req || req.status !== "PENDING") return fail("That request was already handled.");

  const chosen = courseId === undefined ? req.courseId : id.safeParse(courseId).success ? (courseId as string) : null;
  if (!chosen) return fail("Pick the course this title belongs to.");
  const course = await db.course.findUnique({ where: { id: chosen }, select: { id: true } });
  if (!course) return fail("Course not found.");

  await db.$transaction(async (tx) => {
    // Keep an alias a counselor already set.
    if (!(await tx.courseAlias.findUnique({ where: { alias: req.normalizedTitle } }))) {
      await tx.courseAlias.create({ data: { alias: req.normalizedTitle, courseId: chosen, createdById: actor.id } });
    }
    await tx.importRequest.update({ where: { id: req.id }, data: { status: "APPROVED", courseId: chosen, decidedById: actor.id, decidedAt: new Date() } });
    await writeAudit({ actor, action: "import_request.approved", entityType: "ImportRequest", entityId: req.id, after: { alias: req.normalizedTitle, courseId: chosen } }, tx);
  });
  revalidatePath("/admin/catalog/requests");
  return { ok: true };
}

export async function dismissImportRequest(requestId: unknown): Promise<ActionResult> {
  const actor = await requireRole("COUNSELOR", "ADMIN");
  const rid = id.safeParse(requestId);
  if (!rid.success) return fail("Invalid request.");
  const req = await db.importRequest.findUnique({ where: { id: rid.data }, select: { id: true, status: true } });
  if (!req || req.status !== "PENDING") return fail("That request was already handled.");
  await db.$transaction(async (tx) => {
    await tx.importRequest.update({ where: { id: req.id }, data: { status: "DISMISSED", decidedById: actor.id, decidedAt: new Date() } });
    await writeAudit({ actor, action: "import_request.dismissed", entityType: "ImportRequest", entityId: req.id }, tx);
  });
  revalidatePath("/admin/catalog/requests");
  return { ok: true };
}
