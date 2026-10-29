/** Letter grade helpers. Mirrors the `LetterGrade` enum, no framework imports. */

export const GRADES = [
  "F",
  "D",
  "D_PLUS",
  "C_MINUS",
  "C",
  "C_PLUS",
  "B_MINUS",
  "B",
  "B_PLUS",
  "A_MINUS",
  "A",
  "A_PLUS",
] as const;

export type Grade = (typeof GRADES)[number] | "PASS";

const LABELS: Record<Grade, string> = {
  F: "F",
  D: "D",
  D_PLUS: "D+",
  C_MINUS: "C-",
  C: "C",
  C_PLUS: "C+",
  B_MINUS: "B-",
  B: "B",
  B_PLUS: "B+",
  A_MINUS: "A-",
  A: "A",
  A_PLUS: "A+",
  PASS: "Pass",
};

export const gradeText = (g: Grade): string => LABELS[g];

/** Rank from 0 (F) up. `PASS` has no rank: it is a pass, not a mark you can compare. */
export function gradeRank(g: Grade): number | null {
  if (g === "PASS") return null;
  return (GRADES as readonly string[]).indexOf(g);
}

/** True when `have` meets `need`. `null` means the grade cannot be compared (PASS). */
export function gradeAtLeast(have: Grade, need: Grade): boolean | null {
  const h = gradeRank(have);
  const n = gradeRank(need);
  if (h === null || n === null) return null;
  return h >= n;
}

/** Any grade above F counts as passing. PASS counts too. */
export const isPassing = (g: Grade): boolean => g !== "F";
