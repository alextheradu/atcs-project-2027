export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/planner/print-button";
import { requirePageUser } from "@/lib/auth/page";
import { GRADES, buildBoard, statusSentence } from "@/lib/board";
import { formatCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { loadOwnedPlan } from "@/lib/plans/load";
import { PLAN_STATUS_LABEL, gradeLabel, toTracked } from "@/lib/plans/view";
import { getGraduationConfig } from "@/lib/requirements/config";
import { summarize } from "@/lib/requirements";

export const metadata = { title: "Board print view" };

const STATUS = { PLANNED: "", IN_PROGRESS: ", taking now", COMPLETED: ", done" } as const;

/** The Board on paper: black on white to save ink, rows by subject and columns by grade. */
export default async function PrintPlan({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const data = await loadOwnedPlan(id, user.id);
  if (!data) notFound();
  const { plan, entries } = data;
  const [config, profile] = await Promise.all([
    getGraduationConfig(),
    db.studentProfile.findUnique({ where: { userId: user.id }, select: { currentGrade: true } }),
  ]);
  const summary = summarize(entries.map(toTracked), config.rules, config.settings);
  const rows = buildBoard(entries, summary, profile?.currentGrade ?? null);
  const spots = rows.reduce((n, r) => n + GRADES.reduce((m, g) => m + r.cells[g].spots.length, 0), 0);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const printed = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    // Fixed over the app chrome on screen, normal flow when printing.
    <div className="print-sheet fixed inset-0 z-50 overflow-auto bg-white p-6 text-black print:static print:overflow-visible print:p-0 md:p-10">
      <div className="mx-auto max-w-[960px] text-[12px] leading-snug">
        <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
          <Link href="/board" className="text-sm text-black underline underline-offset-4">Back to my board</Link>
          <PrintButton />
        </div>

        <header className="mb-4">
          <h1 className="text-[20px] font-bold">{user.name ?? user.email}: four-year board</h1>
          <p className="mt-0.5">{statusSentence(summary, spots)} {PLAN_STATUS_LABEL[plan.status]}. Printed {printed}.</p>
        </header>

        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr>
              <th className="w-[18%] border-b border-black py-1 pr-2 font-semibold">Subject</th>
              {GRADES.map((g) => {
                const year = summary.years.find((y) => y.grade === g)!;
                return <th key={g} className="border-b border-black px-2 py-1 font-semibold">{g}th, {formatCredits(year.total)} cr</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="break-inside-avoid align-top">
                <th scope="row" className="border-b border-neutral-300 py-1.5 pr-2 font-semibold">
                  {r.label}
                  <span className="block font-normal">{r.status}</span>
                </th>
                {GRADES.map((g) => (
                  <td key={g} className="border-b border-neutral-300 px-2 py-1.5">
                    {r.cells[g].entryIds.map((eid) => {
                      const e = byId.get(eid)!;
                      return (
                        <span key={eid} className="block">
                          {e.name} <span className="tabular-nums">({formatCredits(e.credits)}{STATUS[e.status]}{e.grade ? ` ${gradeLabel(e.grade)}` : ""})</span>
                        </span>
                      );
                    })}
                    {r.cells[g].spots.map((s, i) => <span key={i} className="block italic">Needed: {s.label.replace(/^Pick /, "")}</span>)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {summary.kinds.some((k) => k.provisional > 0) && <p className="mt-2">Some classes count toward a requirement before a counselor has confirmed it.</p>}

        <footer className="mt-6 border-t border-black pt-2">
          Self-reported and unofficial. This is a planning aid made by students, not a transcript or a placement. Course selection and graduation requirements are decided by the school. Not affiliated with Pascack Valley Regional High School District.
        </footer>
      </div>
    </div>
  );
}
