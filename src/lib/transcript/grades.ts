/** Letter on a transcript to the `LetterGrade` enum. Pure. */
export type LetterGradeValue = "A_PLUS" | "A" | "A_MINUS" | "B_PLUS" | "B" | "B_MINUS" | "C_PLUS" | "C" | "C_MINUS" | "D_PLUS" | "D" | "F" | "PASS";

const MAP: Record<string, LetterGradeValue> = {
  "A+": "A_PLUS", A: "A", "A-": "A_MINUS", "B+": "B_PLUS", B: "B", "B-": "B_MINUS",
  "C+": "C_PLUS", C: "C", "C-": "C_MINUS", "D+": "D_PLUS", D: "D", F: "F", P: "PASS",
};

/** Null for grades that earn no credit or have no value here (W withdrawn, I incomplete). */
export const letterToEnum = (letter: string): LetterGradeValue | null => MAP[letter.trim().toUpperCase()] ?? null;
