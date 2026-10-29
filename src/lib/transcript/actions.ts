"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import { MAX_ENTRIES_PER_PLAN, isEditable } from "@/lib/plans/schemas";
import { matchKey } from "./match";
import { importSchema } from "./schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

export interface ImportSummary {
  added: number;
  skipped: string[];
  /** Titles sent to a counselor for review. */
  sentToStaff: number;
}

async function save(input: unknown, source: "IMPORT" | "MANUAL"): Promise<ActionResult<ImportSummary>> {
  const user = await requireUser();
  if (!canUseStudentWorkspace(user.role)) return fail("Importing is for students and admins.");
  try {
    enforceLimit("import", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return fail("You are importing too quickly. Try again in a few minutes.");
    throw e;
  }

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the courses and try again.");
  const { planId, rows, suggestions, missing } = parsed.data;

  // Ownership is part of the query, so another student's plan is simply not found.
  const plan = await db.plan.findFirst({ where: { id: planId, ownerId: user.id }, select: { id: true, status: true } });
  if (!plan) return fail("Plan not found.");
  if (!isEditable(plan.status)) return fail("This plan was submitted for review, so it cannot be changed right now.");

  // An alias must point at a course in this same import, so a student cannot map a title to an unrelated course.
  const rowCourses = new Set(rows.map((r) => r.courseId));
  const safeSuggestions = suggestions.filter((a) => rowCourses.has(a.courseId));
  const ids = [...new Set(rows.map((r) => r.courseId))];
  const courses = await db.course.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, credits: true, plannable: true } });
  const byId = new Map(courses.map((c) => [c.id, c]));
  if (ids.some((i) => !byId.has(i))) return fail("One of those courses no longer exists. Reload and try again.");
  // Archived courses are allowed (a past course may have been retired). Middle school placeholders are not.
  const unplannable = rows.find((r) => !byId.get(r.courseId)!.plannable);
  if (unplannable) return fail(`${byId.get(unplannable.courseId)!.name} cannot go in a plan.`);

  const existing = await db.planEntry.findMany({ where: { planId }, select: { courseId: true } });
  const have = new Set(existing.map((e) => e.courseId));
  const skipped: string[] = [];
  const fresh = rows.filter((r, i) => {
    const dup = have.has(r.courseId) || rows.findIndex((x) => x.courseId === r.courseId) !== i;
    if (dup) skipped.push(byId.get(r.courseId)!.name);
    return !dup;
  });
  if (existing.length + fresh.length > MAX_ENTRIES_PER_PLAN) return fail(`A plan can hold up to ${MAX_ENTRIES_PER_PLAN} courses.`);

  // A title that already names a catalog course or has an alias needs no review.
  const catalogKeys = new Set((await db.course.findMany({ select: { name: true } })).map((c) => matchKey(c.name)));

  let sentToStaff = 0;
  await db.$transaction(async (tx) => {
    for (const r of fresh) {
      const c = byId.get(r.courseId)!;
      const completed = r.status === "COMPLETED";
      await tx.planEntry.create({
        data: {
          planId, courseId: r.courseId, gradeLevel: r.gradeLevel, status: r.status, source,
          grade: completed ? (r.grade ?? null) : null,
          credits: r.credits ?? c.credits,
        },
      });
    }
    if (source === "IMPORT") {
      // Nothing here touches the shared alias table. Staff approve each request first.
      const asks = [...safeSuggestions.map((s) => ({ title: s.title, courseId: s.courseId as string | null })), ...missing.map((m) => ({ title: m.title, courseId: null as string | null }))];
      for (const ask of asks) {
        const normalizedTitle = matchKey(ask.title);
        if (normalizedTitle.length < 2 || catalogKeys.has(normalizedTitle)) continue;
        if (await tx.courseAlias.findUnique({ where: { alias: normalizedTitle } })) continue;
        const existing = await tx.importRequest.findUnique({ where: { studentId_normalizedTitle: { studentId: user.id, normalizedTitle } } });
        if (existing) continue;
        await tx.importRequest.create({ data: { studentId: user.id, title: ask.title, normalizedTitle, courseId: ask.courseId } });
        sentToStaff++;
      }
    }
    await tx.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    // Counts only. The titles and grades stay out of the audit log.
    await writeAudit({ actor: user, action: source === "IMPORT" ? "plan.import" : "plan.bulk_add", entityType: "Plan", entityId: planId, after: { added: fresh.length, requests: sentToStaff } }, tx);
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { ok: true, data: { added: fresh.length, skipped, sentToStaff } };
}

/** Confirmed rows from the import review screen. Only course rows arrive here, never the PDF. */
export async function confirmImport(input: unknown) {
  return save(input, "IMPORT");
}

/** Manual bulk add: search, year, grade. */
export async function bulkAddCourses(input: unknown) {
  return save(input, "MANUAL");
}
