import { z } from "zod";

export const MAX_PLANS = 10;
export const MAX_ENTRIES_PER_PLAN = 60;

export const id = z.string().min(1).max(64);
export const planName = z.string().trim().min(1, "Give the plan a name").max(60);
export const gradeLevel = z.number().int().min(9).max(12);

export const LETTER_GRADES = ["A_PLUS", "A", "A_MINUS", "B_PLUS", "B", "B_MINUS", "C_PLUS", "C", "C_MINUS", "D_PLUS", "D", "F", "PASS"] as const;
export const ENTRY_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED"] as const;

export const addEntrySchema = z.object({ planId: id, courseId: id, gradeLevel });
export const moveEntrySchema = z.object({ entryId: id, gradeLevel });
export const updateEntrySchema = z.object({
  entryId: id,
  status: z.enum(ENTRY_STATUSES).optional(),
  grade: z.enum(LETTER_GRADES).nullable().optional(),
  credits: z.number().min(0).max(30).multipleOf(0.5).optional(),
});

/** Plans a student can still change. Submitted and approved plans are read-only. */
export const EDITABLE_STATUSES = ["DRAFT", "CHANGES_REQUESTED"] as const;
export const isEditable = (status: string) => (EDITABLE_STATUSES as readonly string[]).includes(status);

/** "Plan A", "Plan B", ... the first letter not already used. */
export function nextPlanName(existing: string[]): string {
  const used = new Set(existing.map((n) => n.trim().toLowerCase()));
  for (let i = 0; i < 26; i++) {
    const name = `Plan ${String.fromCharCode(65 + i)}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `Plan ${existing.length + 1}`;
}
