/** "Can I take this class?" in one plain sentence, from the per-grade fits. Pure. */
import type { GradeFit } from "./course-fit";

export interface Answer {
  tone: "eligible" | "warning" | "appeal" | "locked";
  text: string;
  /** The reason behind a "not yet", in the engine's own words. */
  detail?: string;
}

const ordinal = (g: number) => `${g}th`;
function gradeList(grades: number[]): string {
  const words = grades.map(ordinal);
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

/** `currentGrade` hides grades the student has already finished; this year still counts. */
export function canTakeAnswer(all: GradeFit[], opts: { approved: boolean; currentGrade?: number | null }): Answer | null {
  if (all.length === 0) return null;
  if (opts.approved) return { tone: "eligible", text: "Your placement review was approved, so you can take this." };
  const fits = all.filter((f) => f.grade >= (opts.currentGrade ?? 9));
  if (fits.length === 0) return { tone: "locked", text: "This class is offered in grades you have already finished." };

  const yes = fits.filter((f) => f.result.status === "ELIGIBLE" || f.result.viaAppeal);
  if (yes.length > 0) return { tone: "eligible", text: `You can take this in ${gradeList(yes.map((f) => f.grade))} grade.` };

  const warned = fits.filter((f) => f.result.status === "ELIGIBLE_WITH_WARNING");
  if (warned.length > 0) {
    return { tone: "warning", text: `You can take this in ${gradeList(warned.map((f) => f.grade))} grade, but check the details first.`, detail: warned[0].result.summary };
  }

  const ask = fits.find((f) => f.result.status === "NOT_ELIGIBLE_APPEALABLE");
  if (ask) return { tone: "appeal", text: "You need a placement review to take this.", detail: ask.result.summary };

  return { tone: "locked", text: "You can't take this yet.", detail: fits[0].result.summary };
}
