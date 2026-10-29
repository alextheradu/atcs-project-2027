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

const base = z.object({
  planId: id,
  rows: z.array(row).max(MAX_IMPORT_ROWS, `Import up to ${MAX_IMPORT_ROWS} courses at a time.`),
  /** Titles the student matched by hand. A counselor reviews each one before it can help anyone else. */
  suggestions: z.array(z.object({ title: z.string().trim().min(2).max(120), courseId: id })).max(MAX_IMPORT_ROWS).default([]),
  /** Titles that are not in the catalog at all. They go to a counselor or admin. */
  missing: z.array(z.object({ title: z.string().trim().min(2).max(120) })).max(MAX_IMPORT_ROWS).default([]),
});
export const importSchema = base.refine((v) => v.rows.length + v.missing.length > 0, { message: "Pick at least one course." });
export type ImportInput = z.infer<typeof importSchema>;
