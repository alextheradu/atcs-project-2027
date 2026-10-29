/** Pathway graph helpers. Pure. */
import type { Eligibility, GradeFit } from "@/lib/eligibility";

/** completed and planned come from the plan. The rest come from how the course fits it. */
export type NodeKind = "completed" | "planned" | "open" | "appeal" | "locked" | "none";

const ORDER: Eligibility[] = ["ELIGIBLE", "ELIGIBLE_WITH_WARNING", "NOT_ELIGIBLE_APPEALABLE", "NOT_ELIGIBLE_LOCKED"];

/** The grade where the course fits best, or null when it is not offered in grades 9 to 12. */
export function bestFit(fits: GradeFit[]): GradeFit | null {
  let best: GradeFit | null = null;
  for (const f of fits) if (!best || ORDER.indexOf(f.result.status) < ORDER.indexOf(best.result.status)) best = f;
  return best;
}

export function nodeKind(opts: { entry: "COMPLETED" | "PLANNED" | "IN_PROGRESS" | null; hasPlan: boolean; fits: GradeFit[] }): NodeKind {
  if (opts.entry === "COMPLETED") return "completed";
  if (opts.entry) return "planned";
  if (!opts.hasPlan) return "none";
  const best = bestFit(opts.fits);
  if (!best) return "none";
  switch (best.result.status) {
    case "ELIGIBLE":
    case "ELIGIBLE_WITH_WARNING":
      return "open";
    case "NOT_ELIGIBLE_APPEALABLE":
      return "appeal";
    case "NOT_ELIGIBLE_LOCKED":
      return "locked";
  }
}

export const KIND_LABEL: Record<NodeKind, string> = {
  completed: "Completed",
  planned: "In your plan",
  open: "Open to you",
  appeal: "Needs an appeal",
  locked: "Locked",
  none: "",
};

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
