/** Counselor dashboard math. Pure. */

export interface DemandRow {
  studentId: string;
  courseId: string;
  planStatus: string;
  isPrimary: boolean;
  gradeLevel: number;
}

export interface Demand {
  courseId: string;
  /** Distinct students who planned it. */
  students: number;
  byGrade: Record<number, number>;
}

/**
 * Course demand for enrollment decisions. Only primary plans count: a student has one plan, the one on their
 * Board, and staff never see a plan the student cannot open. A student counts once per course.
 */
export function courseDemand(rows: DemandRow[]): Demand[] {
  const counted = rows.filter((r) => r.isPrimary);
  const byCourse = new Map<string, Map<string, number>>();
  for (const r of counted) {
    const m = byCourse.get(r.courseId) ?? new Map<string, number>();
    // Keep the earliest grade a student planned it in if two plans disagree.
    if (!m.has(r.studentId) || r.gradeLevel < (m.get(r.studentId) as number)) m.set(r.studentId, r.gradeLevel);
    byCourse.set(r.courseId, m);
  }
  return [...byCourse.entries()].map(([courseId, m]) => {
    const byGrade: Record<number, number> = {};
    for (const g of m.values()) byGrade[g] = (byGrade[g] ?? 0) + 1;
    return { courseId, students: m.size, byGrade };
  });
}

export type DemandSort = "students" | "name";

export function sortDemand<T extends Demand & { name: string }>(rows: T[], by: DemandSort): T[] {
  return [...rows].sort((a, b) => (by === "name" ? a.name.localeCompare(b.name) : b.students - a.students || a.name.localeCompare(b.name)));
}

export interface OffTrackInput {
  complete: boolean;
  missing: number;
  missingList: { label: string; missing: number }[];
  warnings: { code: string }[];
}

/** A student is off track when the plan leaves a requirement open or breaks a yearly minimum. */
export function offTrackReasons(s: OffTrackInput): string[] {
  const out: string[] = [];
  for (const m of s.missingList) out.push(`${m.label}: ${m.missing} credits short`);
  if (s.warnings.some((w) => w.code === "YEAR_UNDER_MIN")) out.push("A year is under the credit minimum");
  return out;
}
