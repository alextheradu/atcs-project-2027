/** College admission guidance. Pure. The numbers come from the Program of Studies table and admins can edit them. */
import { z } from "zod";

export const SUBJECTS = ["ENGLISH", "MATH", "SOCIAL_STUDIES", "SCIENCE", "WORLD_LANGUAGE"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  ENGLISH: "English",
  MATH: "Mathematics",
  SOCIAL_STUDIES: "Social studies",
  SCIENCE: "Science",
  WORLD_LANGUAGE: "World language",
};

const years = z.number().int().min(0).max(4);

export const guidanceSchema = z.object({
  base: z.object({ ENGLISH: years, MATH: years, SOCIAL_STUDIES: years, SCIENCE: years, WORLD_LANGUAGE: years }),
  majors: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(80),
        keywords: z.array(z.string().trim().toLowerCase().min(2).max(40)).min(1).max(20),
        years: z.object({ ENGLISH: years, MATH: years, SOCIAL_STUDIES: years, SCIENCE: years, WORLD_LANGUAGE: years }).partial(),
      }),
    )
    .max(12),
});
export type GuidanceConfig = z.infer<typeof guidanceSchema>;

export const GUIDANCE_KEY = "collegeGuidance";

/** Program of Studies, "Academic requirements for college admission" (page 12). */
export const DEFAULT_GUIDANCE: GuidanceConfig = {
  base: { ENGLISH: 4, MATH: 3, SOCIAL_STUDIES: 3, SCIENCE: 3, WORLD_LANGUAGE: 2 },
  majors: [
    { label: "Math, science and engineering", keywords: ["math", "mathematics", "science", "engineering", "computer", "physics", "chemistry"], years: { MATH: 4 } },
    { label: "Science, health care and engineering", keywords: ["science", "health", "nursing", "medicine", "medical", "biology", "pre-med", "engineering", "physics", "chemistry"], years: { SCIENCE: 4 } },
  ],
};

export const parseGuidance = (v: unknown): GuidanceConfig => {
  const r = guidanceSchema.safeParse(v);
  return r.success ? r.data : DEFAULT_GUIDANCE;
};

export interface GuidanceLine {
  subject: Subject;
  label: string;
  have: number;
  need: number;
  met: boolean;
}

export interface GuidanceResult {
  lines: GuidanceLine[];
  /** Majors the intended major matched, for the explanation. */
  matched: string[];
}

const words = (s: string) => s.toLowerCase().split(/[^a-z-]+/).filter(Boolean);

/**
 * Years of each subject the plan covers against what colleges recommend. A year counts when the plan
 * has at least one course from that department in it.
 */
export function guidanceFor(config: GuidanceConfig, intendedMajor: string | null | undefined, entries: { department: string; gradeLevel: number }[]): GuidanceResult {
  const typed = new Set(words(intendedMajor ?? ""));
  const matched = config.majors.filter((m) => m.keywords.some((k) => typed.has(k)));
  const lines = SUBJECTS.map((subject) => {
    const need = Math.max(config.base[subject], ...matched.map((m) => m.years[subject] ?? 0));
    const have = new Set(entries.filter((e) => e.department === subject).map((e) => e.gradeLevel)).size;
    return { subject, label: SUBJECT_LABEL[subject], have, need, met: have >= need };
  });
  return { lines, matched: matched.map((m) => m.label) };
}
