"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { bestFitOf } from "./fit";
import { notify } from "@/lib/notifications";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import { id } from "@/lib/plans/schemas";
import { canReview, canTransition, checkWindow, isEditable, isWithdrawable, snapshotUnmet, type WindowEvent } from "./rules";
import { decideSchema, saveDraftSchema } from "./schemas";
import type { Prisma } from "@/generated/prisma/client";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const NOT_FOUND = "Appeal not found.";

/** The student's own appeal. Ownership is part of the query, so someone else's appeal is "not found". */
const ownAppeal = (appealId: string, studentId: string) => db.appeal.findFirst({ where: { id: appealId, studentId } });

async function student() {
  const user = await requireUser();
  if (user.role !== "STUDENT" && user.role !== "INCOMING") return null;
  return user;
}

const windows = async (): Promise<WindowEvent[]> =>
  (await db.timelineEvent.findMany({ where: { kind: "APPEAL_WINDOW" } })).map((e) => ({ ...e, audience: e.audience as WindowEvent["audience"] }));

/**
 * Open (or reopen) the draft for a course. Current students can ask when they miss a requirement or
 * the course needs a placement. Courses they already qualify for, or that are locked, are refused.
 * Incoming 8th graders have no records here, so they may ask about any course.
 */
export async function startAppeal(courseSlug: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await student();
  if (!user) return fail("Placement reviews are for students.");
  if (typeof courseSlug !== "string" || !/^[a-z0-9-]{1,100}$/.test(courseSlug)) return fail("Course not found.");

  const course = await db.course.findUnique({ where: { slug: courseSlug } });
  if (!course || course.archived || !course.plannable) return fail("Course not found.");

  const existing = await db.appeal.findFirst({ where: { studentId: user.id, targetCourseId: course.id, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } } });
  if (existing) return { ok: true, data: { id: existing.id } };

  if (await db.appeal.findFirst({ where: { studentId: user.id, targetCourseId: course.id, status: "APPROVED" }, select: { id: true } })) {
    return fail("A supervisor already approved you for this course.");
  }

  let unmet: { type: string; message: string }[] = [];
  if (user.role === "STUDENT") {
    const fit = await bestFitOf(user.id, course);
    if (!fit) return fail("That course is not offered in grades 9 to 12.");
    if (fit.status === "ELIGIBLE") return fail("You already meet the requirements for this course.");
    if (fit.status === "NOT_ELIGIBLE_LOCKED") return fail("This course is locked. Finish the earlier course in the sequence first.");
    unmet = snapshotUnmet(fit.unmet.length ? fit.unmet : fit.leaves.filter((l) => l.state !== "met"));
  } else if (course.prereqText) {
    unmet = [{ type: "text", message: course.prereqText.slice(0, 300) }];
  }

  const appeal = await db.appeal.create({
    data: { studentId: user.id, targetCourseId: course.id, department: course.department, unmetRules: unmet as unknown as Prisma.InputJsonValue },
    select: { id: true },
  });
  revalidatePath("/appeals");
  return { ok: true, data: { id: appeal.id } };
}

export async function saveDraft(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Placement reviews are for students.");
  const p = saveDraftSchema.safeParse(input);
  if (!p.success) return fail("Check your answers. Each one can be up to 2000 characters.");
  const appeal = await ownAppeal(p.data.appealId, user.id);
  if (!appeal) return fail(NOT_FOUND);
  if (!isEditable(appeal.status)) return fail("This request was already submitted, so it cannot be edited.");

  const questionIds = p.data.answers.map((a) => a.questionId);
  const questions = await db.appealQuestion.findMany({ where: { id: { in: questionIds }, active: true, OR: [{ department: null }, { department: appeal.department }] } });
  const byId = new Map(questions.map((q) => [q.id, q]));

  await db.$transaction(async (tx) => {
    await tx.appeal.update({
      where: { id: appeal.id },
      data: { reportedGrade: p.data.reportedGrade ?? null, reportedAverage: p.data.reportedAverage ?? null, selfReported: true },
    });
    await tx.appealAnswer.deleteMany({ where: { appealId: appeal.id } });
    // The prompt is copied, so a later edit to a question never changes what the reviewer reads.
    const rows = p.data.answers.filter((a) => byId.has(a.questionId) && a.answer.trim()).map((a) => ({ appealId: appeal.id, questionId: a.questionId, prompt: byId.get(a.questionId)!.prompt, answer: a.answer.trim() }));
    if (rows.length) await tx.appealAnswer.createMany({ data: rows });
  });
  revalidatePath(`/appeals/${appeal.id}`);
  return { ok: true };
}

export async function submitAppeal(appealId: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Placement reviews are for students.");
  const aid = id.safeParse(appealId);
  if (!aid.success) return fail(NOT_FOUND);
  try {
    enforceLimit("appeal", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return fail("You are sending requests too quickly. Try again in a little while.");
    throw e;
  }

  const appeal = await db.appeal.findFirst({ where: { id: aid.data, studentId: user.id }, include: { answers: true, targetCourse: { select: { name: true } } } });
  if (!appeal) return fail(NOT_FOUND);
  if (!canTransition(appeal.status, "SUBMITTED")) return fail("This request was already submitted.");

  const check = checkWindow(user.role as "STUDENT" | "INCOMING", await windows());
  if (!check.allowed) {
    return fail(check.nextOpen ? `Requests open on ${check.nextOpen.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Your draft is saved.` : "Requests are not open right now. Your draft is saved, and we will show the dates when they are set.");
  }

  const required = await db.appealQuestion.findMany({ where: { active: true, required: true, OR: [{ department: null }, { department: appeal.department }] }, select: { id: true } });
  const answered = new Set(appeal.answers.map((a) => a.questionId));
  if (required.some((q) => !answered.has(q.id))) return fail("Answer every required question before you send it.");

  // Supervisors of that department are told. With none, admins are.
  let reviewers = await db.user.findMany({ where: { role: "SUPERVISOR", departments: { has: appeal.department } }, select: { id: true } });
  if (reviewers.length === 0) reviewers = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

  await db.$transaction(async (tx) => {
    await tx.appeal.update({ where: { id: appeal.id }, data: { status: "SUBMITTED", submittedAt: new Date(), windowId: check.window?.id ?? null } });
    await notify(tx, reviewers.map((r) => ({ userId: r.id, kind: "APPEAL_SUBMITTED" as const, title: "New placement review request", body: `A student asked to be placed in ${appeal.targetCourse.name}.`, url: `/review/${appeal.id}` })));
    await writeAudit({ actor: user, action: "appeal.submitted", entityType: "Appeal", entityId: appeal.id }, tx);
  });
  revalidatePath("/appeals");
  revalidatePath("/review");
  return { ok: true };
}

export async function withdrawAppeal(appealId: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Placement reviews are for students.");
  const aid = id.safeParse(appealId);
  if (!aid.success) return fail(NOT_FOUND);
  const appeal = await ownAppeal(aid.data, user.id);
  if (!appeal) return fail(NOT_FOUND);
  if (!isWithdrawable(appeal.status)) return fail("Only a submitted request can be withdrawn.");
  await db.$transaction(async (tx) => {
    await tx.appeal.update({ where: { id: appeal.id }, data: { status: "WITHDRAWN" } });
    await writeAudit({ actor: user, action: "appeal.withdrawn", entityType: "Appeal", entityId: appeal.id }, tx);
  });
  revalidatePath("/appeals");
  revalidatePath("/review");
  return { ok: true };
}

/** A discarded draft. Submitted requests are withdrawn instead, so the record stays. */
export async function deleteDraft(appealId: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Placement reviews are for students.");
  const aid = id.safeParse(appealId);
  if (!aid.success) return fail(NOT_FOUND);
  const appeal = await ownAppeal(aid.data, user.id);
  if (!appeal) return fail(NOT_FOUND);
  if (!isEditable(appeal.status)) return fail("Only a draft can be deleted.");
  await db.appeal.delete({ where: { id: appeal.id } });
  revalidatePath("/appeals");
  return { ok: true };
}

const reviewer = () => requireRole("SUPERVISOR", "ADMIN");

/** Mark that a reviewer has started on it. */
export async function startReview(appealId: unknown): Promise<ActionResult> {
  const actor = await reviewer();
  const aid = id.safeParse(appealId);
  if (!aid.success) return fail(NOT_FOUND);
  const appeal = await db.appeal.findUnique({ where: { id: aid.data }, select: { id: true, status: true, department: true } });
  if (!appeal || !canReview(actor, appeal.department)) throw new ForbiddenError();
  if (!canTransition(appeal.status, "UNDER_REVIEW")) return fail("That request is not waiting for review.");
  await db.appeal.update({ where: { id: appeal.id }, data: { status: "UNDER_REVIEW" } });
  revalidatePath("/review");
  return { ok: true };
}

export async function decideAppeal(input: unknown): Promise<ActionResult> {
  const actor = await reviewer();
  const p = decideSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Add a decision and a note.");

  const appeal = await db.appeal.findUnique({ where: { id: p.data.appealId }, include: { targetCourse: { select: { name: true } } } });
  // Another department's appeal is refused outright, not just hidden in the list.
  if (!appeal || !canReview(actor, appeal.department)) throw new ForbiddenError();
  if (!canTransition(appeal.status, p.data.decision)) return fail("That request already has a decision or was withdrawn.");

  await db.$transaction(async (tx) => {
    await tx.appeal.update({ where: { id: appeal.id }, data: { status: p.data.decision, decidedById: actor.id, decidedAt: new Date(), decisionNote: p.data.note } });
    if (p.data.decision === "APPROVED") {
      // Entries for this course on this student's plans now read "Approved via appeal".
      await tx.planEntry.updateMany({ where: { courseId: appeal.targetCourseId, plan: { ownerId: appeal.studentId } }, data: { overrideAppealId: appeal.id } });
    }
    await notify(tx, [{
      userId: appeal.studentId, kind: "APPEAL_DECIDED", title: `Placement review ${p.data.decision === "APPROVED" ? "approved" : "denied"}`,
      body: `Your request for ${appeal.targetCourse.name} was ${p.data.decision === "APPROVED" ? "approved" : "denied"}. Open it to read the note.`, url: `/appeals/${appeal.id}`,
    }]);
    await writeAudit({ actor, action: `appeal.${p.data.decision.toLowerCase()}`, entityType: "Appeal", entityId: appeal.id, after: { decision: p.data.decision } }, tx);
  });
  revalidatePath("/review");
  revalidatePath("/appeals");
  revalidatePath("/plans");
  return { ok: true };
}
