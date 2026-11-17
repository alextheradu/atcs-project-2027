"use client";

import Link from "next/link";
import type { Way } from "@/lib/eligibility";

interface Props {
  ways: Way[];
  /** Course names by slug. A slug is shown when a name is missing. */
  names: Record<string, string>;
  /** The grade the class is planned in, so "alongside" adds to the same year and "before" to the year before. */
  gradeLevel: number;
  /** Slugs already on the board: shown as "On your board" instead of an Add button. */
  onBoard?: Set<string>;
  /** Board only. Without it, each class links to its page. */
  onAdd?: (slug: string, grade: number) => void;
  busy?: boolean;
  /** The earliest grade still open on the board; no Add button suggests a year that is over. */
  firstOpenGrade?: number;
}

const ordinal = (g: number) => `${g}th`;

/** Every open route into a class, each with the classes that would satisfy it, so a problem comes with its fix. */
export function WaysIn({ ways, names, gradeLevel, onBoard, onAdd, busy, firstOpenGrade = 9 }: Props) {
  if (ways.length === 0) return null;
  const several = ways.length > 1;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{several ? "Ways to get in" : "What would fix it"}</p>
      <ol className="space-y-2">
        {ways.map((way, i) => (
          <li key={i} className="space-y-1.5">
            {several && <p className="text-xs font-semibold text-muted">{i === 0 ? "One way" : "Or"}</p>}
            {way.steps.map((step, j) => {
              const grade = step.kind === "alongside" ? gradeLevel : gradeLevel - 1;
              return (
                <div key={j} className="space-y-1.5">
                  <p className="text-sm text-muted">{step.message}</p>
                  {step.courses.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {step.courses.map((slug) => (
                        <li key={slug} className="flex items-center gap-1 rounded-[10px] bg-fill-3 py-1 pl-3 pr-1 text-[13px]">
                          <Link href={`/courses/${slug}`} className="font-medium text-accent-ink hover:underline">{names[slug] ?? slug}</Link>
                          {onBoard?.has(slug) ? (
                            <span className="px-2 text-muted">On your board</span>
                          ) : onAdd && grade >= Math.max(9, firstOpenGrade) ? (
                            <button
                              type="button"
                              className="btn btn-sm h-7 px-2.5"
                              aria-disabled={busy || undefined}
                              aria-label={`Add ${names[slug] ?? slug} to ${ordinal(grade)} grade`}
                              onClick={() => !busy && onAdd(slug, grade)}
                            >
                              Add to {ordinal(grade)}
                            </button>
                          ) : (
                            <span className="pr-2" />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}
