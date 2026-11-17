/** Board markers for the Classes list. Pure, no framework imports. */

export interface BoardEntryLite {
  courseId: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  gradeLevel: number;
}

/** A short label per class on the student's board, keyed by course id. A plan holds each class once. */
export function boardMarks(entries: BoardEntryLite[]): Map<string, string> {
  return new Map(
    entries.map((e) => [
      e.courseId,
      e.status === "COMPLETED" ? "Done" : e.status === "IN_PROGRESS" ? "Taking now" : `On your board, ${e.gradeLevel}th`,
    ]),
  );
}

/** Which subject groups start open: all of them under the open-all rule, else those holding a class on the board. */
export function openGroups<T extends { id: string }>(groups: [string, T[]][], onBoard: Set<string>, openAll: boolean): Set<string> {
  return new Set(groups.filter(([, rows]) => openAll || rows.some((r) => onBoard.has(r.id))).map(([dept]) => dept));
}
