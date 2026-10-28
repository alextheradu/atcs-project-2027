import { z } from "zod";
import { DEPARTMENTS } from "@/lib/admin/schemas";

export const LEVELS = ["CP", "ENHANCED", "HONORS", "AP", "DUAL_ENROLLMENT", "MIDDLE_SCHOOL"] as const;
export const REQUIREMENT_KINDS = [
  "ENGLISH", "MATH", "SCI_BIO", "SCI_CHEM", "SCI_PHYS", "SOCIAL_STUDIES",
  "ARTS", "LIFE_CAREERS", "FIN_LIT", "WORLD_LANG", "PE_HEALTH",
] as const;

const text = (max: number) => z.string().trim().max(max);

export const requirementTagSchema = z.object({
  kind: z.enum(REQUIREMENT_KINDS),
  credits: z.number().min(0).max(30),
  provisional: z.boolean(),
});

export const courseInputSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(100),
    name: text(160).min(1),
    department: z.enum(DEPARTMENTS),
    level: z.enum(LEVELS),
    duration: z.enum(["FULL", "HALF"]),
    credits: z.number().min(0).max(30),
    gradesOffered: z.array(z.number().int().min(8).max(12)).max(5),
    description: text(4000),
    prereqText: text(2000).nullable(),
    dualEnrollmentNote: text(500).nullable(),
    hasApExam: z.boolean(),
    plannable: z.boolean(),
    sourcePage: z.number().int().min(1).max(500).nullable(),
    requirements: z.array(requirementTagSchema).max(REQUIREMENT_KINDS.length),
    interests: z.array(z.string().regex(/^[a-z0-9-]+$/).max(60)).max(20),
  })
  .superRefine((c, ctx) => {
    const kinds = c.requirements.map((r) => r.kind);
    if (new Set(kinds).size !== kinds.length) {
      ctx.addIssue({ code: "custom", message: "Each requirement can be tagged once", path: ["requirements"] });
    }
    if (c.plannable && c.gradesOffered.length === 0) {
      ctx.addIssue({ code: "custom", message: "Plannable courses need at least one grade", path: ["gradesOffered"] });
    }
    if (c.duration === "HALF" && c.credits !== 2.5 && c.plannable) {
      ctx.addIssue({ code: "custom", message: "Half-year courses are 2.5 credits", path: ["credits"] });
    }
  });

export type CourseInput = z.infer<typeof courseInputSchema>;

export const aliasSchema = z.object({
  courseId: z.string().min(1).max(64),
  alias: z.string().trim().min(2).max(160),
});

export const courseFilterSchema = z.object({
  q: z.string().trim().max(100).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  level: z.enum(LEVELS).optional(),
  duration: z.enum(["FULL", "HALF"]).optional(),
  grade: z.coerce.number().int().min(9).max(12).optional(),
  interest: z.string().regex(/^[a-z0-9-]+$/).max(60).optional(),
  includeArchived: z.boolean().optional(),
});

export type CourseFilter = z.infer<typeof courseFilterSchema>;
