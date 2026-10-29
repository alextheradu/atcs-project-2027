/** Shapes shared by the planner page and its client components. Pure. */
import type { Rule } from "@/lib/eligibility";
import type { WarnEntry } from "@/lib/plan-warnings";
import type { CourseTag, EntryStatus, TrackedEntry } from "@/lib/requirements";

export interface EntryView {
  id: string;
  courseId: string;
  slug: string;
  name: string;
  department: string;
  level: string;
  duration: "FULL" | "HALF";
  gradeLevel: number;
  status: EntryStatus;
  grade: string | null;
  /** Credits counted for this entry. */
  credits: number;
  /** Catalog credits. */
  courseCredits: number;
  gradesOffered: number[];
  tags: CourseTag[];
  rules: Rule | null;
  prereqText: string | null;
  /** The entry carries an approved appeal (Phase 7). */
  approvedAppeal: boolean;
}

export const toTracked = (e: EntryView): TrackedEntry => ({
  id: e.id,
  gradeLevel: e.gradeLevel,
  status: e.status,
  credits: e.credits,
  courseCredits: e.courseCredits,
  tags: e.tags,
});

export const toWarnEntry = (e: EntryView): WarnEntry => ({
  id: e.id,
  name: e.name,
  gradeLevel: e.gradeLevel,
  credits: e.credits,
  gradesOffered: e.gradesOffered,
});

const GRADE_LABEL: Record<string, string> = {
  A_PLUS: "A+", A: "A", A_MINUS: "A-", B_PLUS: "B+", B: "B", B_MINUS: "B-", C_PLUS: "C+", C: "C", C_MINUS: "C-",
  D_PLUS: "D+", D: "D", F: "F", PASS: "Pass",
};
export const gradeLabel = (g: string | null) => (g ? (GRADE_LABEL[g] ?? g) : "");
export const GRADE_OPTIONS = Object.entries(GRADE_LABEL).map(([value, label]) => ({ value, label }));

export const STATUS_LABEL: Record<EntryStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};
