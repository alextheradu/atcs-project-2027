/** "Can I take this class?" in one plain sentence, from the per-grade fits. Pure. */
import type { GradeFit } from "./course-fit";

export interface Answer {
  tone: "eligible" | "warning" | "appeal" | "locked";
  text: string;
  /** The reason behind a "not yet", in the engine's own words. */
  detail?: string;
  /** What a person still decides (a recommendation, a placement exam). Information, not a warning. */
  note?: string;
}

const ordinal = (g: number) => `${g}th`;
function gradeList(grades: number[]): string {
  const words = grades.map(ordinal);
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

const withNote = (a: Answer, notes: string[]): Answer => (notes[0] ? { ...a, note: notes[0] } : a);

/**
 * `currentGrade` hides grades the student has already finished; this year still counts.
 * `taken` short-circuits for a class the student finished or is taking. `plannedGrade` judges only the grade
 * the class sits in on the board, so the page agrees with the tile.
 */
export function canTakeAnswer(
  all: GradeFit[],
  opts: { approved: boolean; currentGrade?: number | null; taken?: "COMPLETED" | "IN_PROGRESS"; plannedGrade?: number },
): Answer | null {
  if (opts.taken) return { tone: "eligible", text: opts.taken === "COMPLETED" ? "You took this class." : "You are taking this class now." };
  if (all.length === 0) return null;
  if (opts.approved) return { tone: "eligible", text: "Your placement review was approved, so you can take this." };

  const planned = opts.plannedGrade !== undefined ? all.find((f) => f.grade === opts.plannedGrade) : undefined;
  if (planned) {
    const r = planned.result;
    const where = `${ordinal(planned.grade)} grade, where it is on your board`;
    if (r.status === "ELIGIBLE" || r.viaAppeal) return withNote({ tone: "eligible", text: `You can take this in ${where}.` }, r.notes);
    if (r.status === "ELIGIBLE_WITH_WARNING") return { tone: "warning", text: `You can take this in ${where}, but check the details first.`, detail: r.summary };
    // A missing partner class is fixed by adding a class, so it reads like the Board tile, not like a review.
    if (r.unmet.length > 0 && r.unmet.every((l) => l.rule.type === "coreq")) {
      return { tone: "warning", text: `To take this in ${where}, add its partner class.`, detail: r.summary };
    }
    if (r.status === "NOT_ELIGIBLE_APPEALABLE") return { tone: "appeal", text: `In ${where}, you need a placement review.`, detail: r.summary };
    return { tone: "locked", text: `You can't take this in ${where} yet.`, detail: r.summary };
  }

  const fits = all.filter((f) => f.grade >= (opts.currentGrade ?? 9));
  if (fits.length === 0) return { tone: "locked", text: "This class is offered in grades you have already finished." };

  const yes = fits.filter((f) => f.result.status === "ELIGIBLE" || f.result.viaAppeal);
  if (yes.length > 0) return withNote({ tone: "eligible", text: `You can take this in ${gradeList(yes.map((f) => f.grade))} grade.` }, yes[0].result.notes);

  const warned = fits.filter((f) => f.result.status === "ELIGIBLE_WITH_WARNING");
  if (warned.length > 0) {
    return { tone: "warning", text: `You can take this in ${gradeList(warned.map((f) => f.grade))} grade, but check the details first.`, detail: warned[0].result.summary };
  }

  const ask = fits.find((f) => f.result.status === "NOT_ELIGIBLE_APPEALABLE");
  if (ask) return { tone: "appeal", text: "You need a placement review to take this.", detail: ask.result.summary };

  return { tone: "locked", text: "You can't take this yet.", detail: fits[0].result.summary };
}
