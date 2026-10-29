/** Grade pick to cohort, role and graduation year, plus when an 8th grade snapshot expires. Pure. */

export type PickedGrade = 8 | 9 | 10 | 11 | 12;
export const PICKED_GRADES: PickedGrade[] = [8, 9, 10, 11, 12];

export interface Placement {
  cohort: "CURRENT" | "INCOMING_8";
  /** Only ever a student role. A grade pick can never grant staff access. */
  role: "STUDENT" | "INCOMING";
  gradYear: number;
  currentGrade: PickedGrade;
}

/** School years start in July. In October 2026, a 9th grader graduates in 2030. */
export function placementForGrade(grade: PickedGrade, now = new Date()): Placement {
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const gradYear = startYear + 1 + (12 - grade);
  return grade === 8
    ? { cohort: "INCOMING_8", role: "INCOMING", gradYear, currentGrade: grade }
    : { cohort: "CURRENT", role: "STUDENT", gradYear, currentGrade: grade };
}

/**
 * The snapshot is deleted at the end of the first appeal cycle: the close of the first appeal window
 * that has not ended yet. With no window scheduled, fall back to August 31, the end of the summer
 * the student enters high school.
 */
export function snapshotExpiry(windows: { closesAt: Date | null }[], now = new Date()): Date {
  const future = windows
    .map((w) => w.closesAt)
    .filter((d): d is Date => d !== null && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  if (future[0]) return future[0];
  const aug = new Date(Date.UTC(now.getUTCFullYear(), 7, 31, 23, 59, 59));
  return aug.getTime() > now.getTime() ? aug : new Date(Date.UTC(now.getUTCFullYear() + 1, 7, 31, 23, 59, 59));
}
