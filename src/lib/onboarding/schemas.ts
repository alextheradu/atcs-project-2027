import { z } from "zod";

const grade = z.enum(["A_PLUS", "A", "A_MINUS", "B_PLUS", "B", "B_MINUS", "C_PLUS", "C", "C_MINUS", "D_PLUS", "D"]);
/** "I don't know yet" and "Prefer not to say" both store nothing. */
const optGrade = z.union([grade, z.literal(""), z.null()]).transform((v) => (v ? v : null));

export const gradePickSchema = z.object({ grade: z.union([z.literal(8), z.literal(9), z.literal(10), z.literal(11), z.literal(12)]) });

export const currentBackgroundSchema = z.object({
  eighthMath: z.enum(["ALGEBRA_I", "PRE_ALGEBRA", "UNSURE"]),
  eighthMathGrade: optGrade.optional(),
  languageStudied: z.enum(["chinese", "french", "italian", "spanish", "none"]).default("none"),
  languageLevel: z.number().int().min(1).max(5).nullable().optional(),
  start: z.enum(["blank", "import"]).default("blank"),
});

export const incomingBackgroundSchema = z
  .object({
    interests: z.array(z.string().regex(/^[a-z-]{1,40}$/)).max(11),
    eighthMath: z.enum(["ALGEBRA_I", "PRE_ALGEBRA", "UNSURE"]),
    eighthMathGrade: optGrade.optional(),
    scienceGrade: optGrade.optional(),
    englishGrade: optGrade.optional(),
    historyGrade: optGrade.optional(),
    languageStudied: z.enum(["chinese", "french", "italian", "spanish", "none"]).default("none"),
    languageLevel: z.number().int().min(1).max(5).nullable().optional(),
    honest: z.literal(true, { error: "Please confirm you are answering honestly." }),
  });

export const majorSchema = z.object({ intendedMajor: z.string().trim().max(120).optional() });

export const HONESTY_TEXT =
  "Be honest here. Nobody is grading you and this does not change your real placement. It only helps us suggest classes that fit you. If you enter higher grades than you have, you will get suggestions that are too hard and a plan you may not be placed into. The school decides your real placement from your actual records.";
