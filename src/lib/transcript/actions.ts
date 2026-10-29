"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
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
  aliasesSaved: number;
}

async function save(input: unknown, source: "IMPORT" | "MANUAL"): Promise<ActionResult<ImportSummary>> {
  const user = await requireUser();
  // Student roles only, enforced here and not just on the page.
  if (user.role !== "STUDENT" && user.role !== "INCOMING") return fail("Importing is for students.");
  try {
    enforceLimit("import", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return fail("You are importing too quickly. Try again in a few minutes.");
    throw e;
  }

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the courses and try again.");
  const { planId, rows, aliases } = parsed.data;

  // Ownership is part of the query, so another student's plan is simply not found.
  const plan = await db.plan.findFirst({ where: { id: planId, ownerId: user.id }, select: { id: true, status: true } });
  if (!plan) return fail("Plan not found.");
  if (!isEditable(plan.status)) return fail("This plan was submitted for review, so it cannot be changed right now.");

  // An alias must point at a course in this same import, so a student cannot map a title to an unrelated course.
  const rowCourses = new Set(rows.map((r) => r.courseId));
  const safeAliases = aliases.filter((a) => rowCourses.has(a.courseId));
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

  // Titles that already equal a catalog course name must never be redirected by an alias.
  const catalogKeys = new Set((await db.course.findMany({ select: { name: true } })).map((c) => matchKey(c.name)));

  let aliasesSaved = 0;
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
      for (const a of safeAliases) {
        const alias = matchKey(a.title);
        if (alias.length < 2 || catalogKeys.has(alias)) continue;
        // Never overwrite an alias a counselor set. Only add new ones.
        if (await tx.courseAlias.findUnique({ where: { alias } })) continue;
        await tx.courseAlias.create({ data: { alias, courseId: a.courseId, createdById: user.id } });
        aliasesSaved++;
      }
    }
    await tx.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    // Counts only. The titles and grades stay out of the audit log.
    await writeAudit({ actor: user, action: source === "IMPORT" ? "plan.import" : "plan.bulk_add", entityType: "Plan", entityId: planId, after: { added: fresh.length, aliases: aliasesSaved } }, tx);
  });

  revalidatePath("/plans");
  revalidatePath(`/plans/${planId}`);
  return { ok: true, data: { added: fresh.length, skipped, aliasesSaved } };
}

/** Confirmed rows from the import review screen. Only course rows arrive here, never the PDF. */
export async function confirmImport(input: unknown) {
  return save(input, "IMPORT");
}

/** Manual bulk add: search, year, grade. */
export async function bulkAddCourses(input: unknown) {
  return save(input, "MANUAL");
}
