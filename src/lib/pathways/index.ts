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
