"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { AGE_COOKIE, signAge, verifyAge, AGE_TTL_MS } from "@/lib/age-gate";
import { db } from "@/lib/db";
import { buildStarterPlan, type StarterCourse } from "@/lib/starter-plan";
import type { Grade } from "@/lib/eligibility";
import { latestPolicies } from "./gate";
import { placementForGrade } from "./placement";
import { currentBackgroundSchema, gradePickSchema, incomingBackgroundSchema, majorSchema } from "./schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
};

/** Admins may optionally onboard with their own profile while keeping their role. */
async function student() {
  const user = await requireUser();
  if (!canUseStudentWorkspace(user.role)) return null;
  return user;
}

async function progress(userId: string, step: number) {
  await db.onboardingProgress.upsert({ where: { userId }, create: { userId, step }, update: { step } });
}

/** Before sign-in. Under 13 stores nothing and blocks this browser for a few hours. 13 or older is remembered only as a signed flag. */
export async function answerAge(over13: boolean): Promise<void> {
  (await cookies()).set(AGE_COOKIE, signAge(over13 ? "over13" : "under13", secret()), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: AGE_TTL_MS / 1000,
  });
}

export async function chooseGrade(input: unknown, ageOk = false): Promise<ActionResult<{ role: string }>> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const parsed = gradePickSchema.safeParse(input);
  if (!parsed.success) return fail("Pick a grade.");

  const cookieAge = verifyAge((await cookies()).get(AGE_COOKIE)?.value, secret());
  if (cookieAge === "under13") return fail("Come back when you are 13.");
  const existing = await db.user.findUnique({ where: { id: user.id }, select: { ageConfirmed13At: true } });
  if (!existing?.ageConfirmed13At && cookieAge !== "over13" && !ageOk) return fail("Confirm that you are 13 or older.");

  const p = placementForGrade(parsed.data.grade);
  const role = user.role === "ADMIN" ? "ADMIN" : p.role;
  await db.$transaction(async (tx) => {
    // Grade choices cannot grant a staff role or remove an admin's access.
    await tx.user.update({ where: { id: user.id }, data: { role, ageConfirmed13At: existing?.ageConfirmed13At ?? new Date() } });
    await tx.studentProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, cohort: p.cohort, gradYear: p.gradYear, currentGrade: p.currentGrade },
      update: { cohort: p.cohort, gradYear: p.gradYear, currentGrade: p.currentGrade },
    });
  });
  await progress(user.id, 1);
  return { ok: true, data: { role } };
}

export async function acceptPolicies(): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const docs = await latestPolicies();
  await db.policyAcceptance.createMany({ data: docs.map((d) => ({ userId: user.id, documentId: d.id })), skipDuplicates: true });
  await progress(user.id, 2);
  return { ok: true };
}

export async function setStep(step: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const n = z.number().int().min(0).max(7).safeParse(step);
  if (!n.success) return fail("Invalid step.");
  await progress(user.id, n.data);
  return { ok: true };
}

const language = (name: string, level: number | null | undefined) => (name === "none" ? { languageStudied: null, languageLevel: null } : { languageStudied: name, languageLevel: level ?? 1 });

export async function saveCurrentBackground(input: unknown): Promise<ActionResult<{ start: "blank" | "import" }>> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const parsed = currentBackgroundSchema.safeParse(input);
  if (!parsed.success) return fail("Check your answers.");
  const d = parsed.data;
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { cohort: true } });
  if (!profile || profile.cohort !== "CURRENT") return fail("Pick your grade first.");
  await db.studentProfile.update({
    where: { userId: user.id },
    data: { eighthMath: d.eighthMath, eighthMathGrade: d.eighthMathGrade ?? null, ...language(d.languageStudied, d.languageLevel) },
  });
  await progress(user.id, 4);
  return { ok: true, data: { start: d.start } };
}

export async function saveIncomingBackground(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const parsed = incomingBackgroundSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your answers.");
  const d = parsed.data;
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { cohort: true } });
  if (!profile || profile.cohort !== "INCOMING_8") return fail("Pick your grade first.");

  const tags = await db.interestTag.findMany({ where: { slug: { in: d.interests } }, select: { id: true } });
  const { snapshotExpiry } = await import("./placement");
  const windows = await db.timelineEvent.findMany({ where: { kind: "APPEAL_WINDOW", audience: { in: ["ALL", "INCOMING"] } }, select: { closesAt: true } });

  await db.studentProfile.update({
    where: { userId: user.id },
    data: {
      eighthMath: d.eighthMath, eighthMathGrade: d.eighthMathGrade ?? null, scienceGrade: d.scienceGrade ?? null,
      englishGrade: d.englishGrade ?? null, historyGrade: d.historyGrade ?? null, ...language(d.languageStudied, d.languageLevel),
      selfReported: true, honestyConfirmedAt: new Date(), snapshotExpiresAt: snapshotExpiry(windows),
      interests: { set: tags.map((t) => ({ id: t.id })) },
    },
  });
  await progress(user.id, 4);
  return { ok: true };
}

export async function saveMajor(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const parsed = majorSchema.safeParse(input);
  if (!parsed.success) return fail("That is too long.");
  await db.studentProfile.updateMany({ where: { userId: user.id }, data: { intendedMajor: parsed.data.intendedMajor || null } });
  await progress(user.id, 5);
  return { ok: true };
}

/** Creates Plan A once. 8th graders get the rule based starter plan, current students a blank plan. */
export async function finishOnboarding(): Promise<ActionResult<{ planId: string }>> {
  const user = await student();
  if (!user) return fail("Onboarding is for students.");
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id }, include: { interests: { select: { slug: true } } } });
  if (!profile) return fail("Pick your grade first.");

  const existing = await db.plan.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  let planId = existing?.id;
  if (!planId) {
    const picks =
      profile.cohort === "INCOMING_8"
        ? buildStarterPlan(await starterCourses(), {
            interests: profile.interests.map((i) => i.slug),
            eighthMath: profile.eighthMath,
            mathGrade: profile.eighthMathGrade as Grade | null,
            scienceGrade: profile.scienceGrade as Grade | null,
            englishGrade: profile.englishGrade as Grade | null,
            historyGrade: profile.historyGrade as Grade | null,
            language: profile.languageStudied && ["chinese", "french", "italian", "spanish"].includes(profile.languageStudied)
              ? { name: profile.languageStudied as "spanish", level: profile.languageLevel ?? 1 }
              : null,
          }).picks
        : [];
    const courses = picks.length ? await db.course.findMany({ where: { id: { in: picks.map((p) => p.courseId) } }, select: { id: true, credits: true } }) : [];
    const plan = await db.plan.create({
      data: {
        ownerId: user.id, name: profile.cohort === "INCOMING_8" ? "Plan A (starter draft)" : "Plan A", isPrimary: true,
        entries: { create: courses.map((c) => ({ courseId: c.id, gradeLevel: 9, credits: c.credits, source: "STARTER" as const })) },
      },
    });
    planId = plan.id;
  }
  await db.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  await progress(user.id, 7);
  return { ok: true, data: { planId } };
}

async function starterCourses(): Promise<StarterCourse[]> {
  const rows = await db.course.findMany({
    where: { archived: false },
    include: { interests: { select: { slug: true } }, requirements: { select: { kind: true } } },
  });
  return rows.map((c) => ({
    id: c.id, slug: c.slug, name: c.name, level: c.level, credits: Number(c.credits), gradesOffered: c.gradesOffered,
    interests: c.interests.map((i) => i.slug), kinds: c.requirements.map((r) => r.kind), hasPrereq: !!c.prereqText, plannable: c.plannable,
  }));
}
