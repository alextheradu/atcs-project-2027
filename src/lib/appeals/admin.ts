"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { id } from "@/lib/plans/schemas";
import { canEditDepartment } from "@/lib/rules/scope";
import { questionSchema, timelineSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Admins edit any question, including the ones for every department. Supervisors edit only their own departments'. */
function mayEditQuestion(actor: { role: "ADMIN" | "SUPERVISOR"; departments: readonly string[] }, department: string | null) {
  if (department === null) return actor.role === "ADMIN";
  return canEditDepartment(actor as never, department as never);
}

export async function saveQuestion(questionId: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requireRole("ADMIN", "SUPERVISOR");
  const p = questionSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the question.");
  const q = p.data;
  if (!mayEditQuestion(actor as never, q.department)) throw new ForbiddenError();
  if (q.type === "CHOICE" && (!q.options || q.options.length < 2)) return fail("A choice question needs at least two options.");

  const data = { department: q.department, prompt: q.prompt, helpText: q.helpText || null, type: q.type, options: q.type === "CHOICE" ? (q.options as Prisma.InputJsonValue) : undefined, required: q.required, sortOrder: q.sortOrder, active: q.active };

  if (questionId === null || questionId === undefined) {
    const row = await db.$transaction(async (tx) => {
      const r = await tx.appealQuestion.create({ data });
      await writeAudit({ actor, action: "appeal_question.created", entityType: "AppealQuestion", entityId: r.id, after: { prompt: q.prompt, department: q.department } }, tx);
      return r;
    });
    revalidatePath("/admin/appeal-questions");
    return { ok: true, data: { id: row.id } };
  }

  const qid = id.safeParse(questionId);
  if (!qid.success) return fail("Question not found.");
  const existing = await db.appealQuestion.findUnique({ where: { id: qid.data } });
  if (!existing) return fail("Question not found.");
  // Both where it is now and where it is going must be in scope.
  if (!mayEditQuestion(actor as never, existing.department)) throw new ForbiddenError();

  await db.$transaction(async (tx) => {
    await tx.appealQuestion.update({ where: { id: existing.id }, data });
    await writeAudit({ actor, action: "appeal_question.updated", entityType: "AppealQuestion", entityId: existing.id, before: { prompt: existing.prompt, active: existing.active }, after: { prompt: q.prompt, active: q.active } }, tx);
  });
  revalidatePath("/admin/appeal-questions");
  return { ok: true, data: { id: existing.id } };
}

const admin = () => requireRole("ADMIN");

export async function createTimelineEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await admin();
  const p = timelineSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the dates.");
  const row = await db.$transaction(async (tx) => {
    const r = await tx.timelineEvent.create({ data: { ...p.data, closesAt: p.data.closesAt ?? null } });
    await writeAudit({ actor, action: "timeline.created", entityType: "TimelineEvent", entityId: r.id, after: { kind: p.data.kind, label: p.data.label, schoolYear: p.data.schoolYear } }, tx);
    return r;
  });
  revalidatePath("/admin/timeline");
  return { ok: true, data: { id: row.id } };
}

export async function deleteTimelineEvent(eventId: unknown): Promise<ActionResult> {
  const actor = await admin();
  const eid = id.safeParse(eventId);
  if (!eid.success) return fail("Event not found.");
  const existing = await db.timelineEvent.findUnique({ where: { id: eid.data } });
  if (!existing) return fail("Event not found.");
  await db.$transaction(async (tx) => {
    await tx.timelineEvent.delete({ where: { id: existing.id } });
    await writeAudit({ actor, action: "timeline.deleted", entityType: "TimelineEvent", entityId: existing.id, before: { kind: existing.kind, label: existing.label } }, tx);
  });
  revalidatePath("/admin/timeline");
  return { ok: true };
}
