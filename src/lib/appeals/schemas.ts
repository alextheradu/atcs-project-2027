import { z } from "zod";
import { LETTER_GRADES, id } from "@/lib/plans/schemas";

export const MAX_ANSWER = 2000;
export const MAX_QUESTIONS = 20;

export const saveDraftSchema = z.object({
  appealId: id,
  reportedGrade: z.enum(LETTER_GRADES).nullable().optional(),
  /** The student's own test/quiz average in the prerequisite. Self-reported, never verified here. */
  reportedAverage: z.number().min(0).max(100).nullable().optional(),
  answers: z.array(z.object({ questionId: id, answer: z.string().max(MAX_ANSWER) })).max(MAX_QUESTIONS),
});

export const decideSchema = z.object({
  appealId: id,
  decision: z.enum(["APPROVED", "DENIED"]),
  note: z.string().trim().min(3, "Add a short note for the student.").max(MAX_ANSWER),
});

export const questionSchema = z.object({
  department: z.enum(["ENGLISH", "SOCIAL_STUDIES", "MATH", "COMPUTER_SCIENCE", "SCIENCE", "WORLD_LANGUAGE", "ART", "BUSINESS", "FAMILY_CONSUMER_SCIENCES", "HEALTH_PE", "MUSIC", "TECHNOLOGY", "SPECIAL_ED", "OTHER"]).nullable(),
  prompt: z.string().trim().min(3).max(300),
  helpText: z.string().trim().max(300).nullable().optional(),
  type: z.enum(["TEXT", "LONG_TEXT", "NUMBER", "YES_NO", "CHOICE"]),
  options: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  required: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  active: z.boolean(),
});

export const timelineSchema = z.object({
  kind: z.enum(["GRADES_DUE", "COURSE_SELECTION", "APPEAL_WINDOW", "APPEAL_DECISIONS", "OTHER"]),
  audience: z.enum(["CURRENT", "INCOMING", "ALL"]),
  label: z.string().trim().min(2).max(120),
  schoolYear: z.string().regex(/^\d{4}-\d{2}$/, "Use a school year like 2027-28."),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date().nullable().optional(),
}).refine((v) => !v.closesAt || v.closesAt >= v.opensAt, { message: "The end date must be after the start." });
