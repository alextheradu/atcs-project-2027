import { z } from "zod";
import { gradeLevel, id, updateEntrySchema } from "@/lib/plans/schemas";

const patch = updateEntrySchema.omit({ entryId: true });
const changeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("add"), courseId: id, gradeLevel }),
  z.object({ kind: z.literal("move"), courseId: id, gradeLevel }),
  z.object({ kind: z.literal("remove"), courseId: id }),
  z.object({ kind: z.literal("update"), courseId: id, patch }),
]);
export type PlanChange = z.infer<typeof changeSchema>;
interface Entry { id: string; courseId: string; gradeLevel: number; status: string; grade: string | null; credits: number }

/** null means already saved. Conflicts need a person, never a silent replay. */
export function recoverPlanChange(raw: unknown, entries: Entry[]) {
  const parsed = changeSchema.safeParse(raw);
  if (!parsed.success) return { conflict: true } as const;
  const change = parsed.data;
  const entry = entries.find((e) => e.courseId === change.courseId);
  if (change.kind === "add") {
    if (!entry) return change;
    return entry.gradeLevel === change.gradeLevel ? null : { conflict: true } as const;
  }
  if (change.kind === "remove") return entry ? { kind: "remove", entryId: entry.id } as const : null;
  if (!entry) return { conflict: true } as const;
  if (change.kind === "move") return entry.gradeLevel === change.gradeLevel ? null : { kind: "move", entryId: entry.id, gradeLevel: change.gradeLevel } as const;
  if (Object.entries(change.patch).every(([k, value]) => entry[k as keyof Entry] === value)) return null;
  return { kind: "update", entryId: entry.id, patch: change.patch } as const;
}
