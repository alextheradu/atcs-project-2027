import { z } from "zod";
import { LETTER_GRADES, gradeLevel, id } from "@/lib/plans/schemas";

export const MAX_IMPORT_ROWS = 60;

const row = z.object({
  courseId: id,
  gradeLevel,
  status: z.enum(["COMPLETED", "IN_PROGRESS", "PLANNED"]),
  grade: z.enum(LETTER_GRADES).nullable().optional(),
  /** Credits the transcript printed. Left out for courses in progress, which use the catalog value. */
  credits: z.number().min(0).max(30).multipleOf(0.5).nullable().optional(),
});

export const importSchema = z.object({
  planId: id,
  rows: z.array(row).min(1, "Pick at least one course.").max(MAX_IMPORT_ROWS, `Import up to ${MAX_IMPORT_ROWS} courses at a time.`),
  /** Transcript titles the student mapped by hand. Saved so the next import matches on its own. */
  aliases: z.array(z.object({ title: z.string().trim().min(2).max(120), courseId: id })).max(MAX_IMPORT_ROWS).default([]),
});
export type ImportInput = z.infer<typeof importSchema>;
