"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { db } from "@/lib/db";

type Result = { ok: true } | { ok: false; error: string };

const grade = z.enum(["A_PLUS", "A", "A_MINUS", "B_PLUS", "B", "B_MINUS", "C_PLUS", "C", "C_MINUS", "D_PLUS", "D", "F", "PASS"]);
const priorSchema = z.object({
  eighthMath: z.enum(["ALGEBRA_I", "PRE_ALGEBRA", "UNSURE"]),
  eighthMathGrade: z.union([grade, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
});

/** The student's own 8th grade math, set from the class sheet where a math class asks for it. */
export async function savePriorMath(input: unknown): Promise<Result> {
  const user = await requireUser();
  if (!canUseStudentWorkspace(user.role)) return { ok: false, error: "Only students have 8th grade math on file." };
  const parsed = priorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick your 8th grade math class." };
  const profile = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { userId: true } });
  if (!profile) return { ok: false, error: "Finish setting up your account first." };
  await db.studentProfile.update({ where: { userId: user.id }, data: { eighthMath: parsed.data.eighthMath, eighthMathGrade: parsed.data.eighthMathGrade } });
  return { ok: true };
}
