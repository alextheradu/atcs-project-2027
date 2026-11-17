/** Pathway helpers. Pure. The subject maps students see live in ./maps. */
import type { Eligibility, GradeFit } from "@/lib/eligibility";

const ORDER: Eligibility[] = ["ELIGIBLE", "ELIGIBLE_WITH_WARNING", "NOT_ELIGIBLE_APPEALABLE", "NOT_ELIGIBLE_LOCKED"];

/** The grade where the course fits best, or null when it is not offered in grades 9 to 12. */
export function bestFit(fits: GradeFit[]): GradeFit | null {
  let best: GradeFit | null = null;
  for (const f of fits) if (!best || ORDER.indexOf(f.result.status) < ORDER.indexOf(best.result.status)) best = f;
  return best;
}

/** Tracks for the `CourseEdge` steps staff edit, which feed "Usually comes after" and "Leads to" on class pages. */
export const TRACKS = ["MATH", "SCIENCE", "COMPUTER_SCIENCE", "WORLD_LANGUAGE", "ENGLISH", "SOCIAL_STUDIES"] as const;
export type Track = (typeof TRACKS)[number];
export const TRACK_LABEL: Record<Track, string> = {
  MATH: "Math",
  SCIENCE: "Science",
  COMPUTER_SCIENCE: "Computer science",
  WORLD_LANGUAGE: "World language",
  ENGLISH: "English",
  SOCIAL_STUDIES: "Social studies",
};

/**
 * The grade the student is in now: the profile's grade when known, otherwise the year after their last
 * completed class on the Board (capped at 12th). Null when neither says.
 */
export function studentGrade(currentGrade: number | null | undefined, entries: { status: string; gradeLevel: number }[]): number | null {
  if (currentGrade) return currentGrade;
  const done = entries.filter((e) => e.status === "COMPLETED").map((e) => e.gradeLevel);
  return done.length ? Math.min(12, Math.max(...done) + 1) : null;
}

/** The map column for a grade ("11th grade", or one that starts there like "11th or 12th grade"), or null. */
export function gradeColumn(columns: string[], grade: number | null): number | null {
  if (grade === null) return null;
  const exact = columns.indexOf(`${grade}th grade`);
  const i = exact >= 0 ? exact : columns.findIndex((c) => c.startsWith(`${grade}th `));
  return i >= 0 ? i : null;
}
