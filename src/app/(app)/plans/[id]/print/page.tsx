export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/planner/print-button";
import { requirePageUser } from "@/lib/auth/page";
import { formatCredits, sumCredits } from "@/lib/credits";
import { loadOwnedPlan } from "@/lib/plans/load";
import { PLAN_STATUS_LABEL, toTracked } from "@/lib/plans/view";
import { getGraduationConfig } from "@/lib/requirements/config";
import { summarize } from "@/lib/requirements";

export const metadata = { title: "plan print view" };

const STATUS = { PLANNED: "planned", IN_PROGRESS: "in progress", COMPLETED: "completed" } as const;

export default async function PrintPlan({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const data = await loadOwnedPlan(id, user.id);
  if (!data) notFound();
  const { plan, entries } = data;
  const config = await getGraduationConfig();
  const summary = summarize(entries.map(toTracked), config.rules, config.settings);
  const printed = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    // Fixed over the app chrome on screen, normal flow when printing.
    <div className="print-sheet fixed inset-0 z-50 overflow-auto bg-white p-6 text-black print:static print:overflow-visible print:p-0 md:p-10">
      <div className="mx-auto max-w-[900px] text-[12px] leading-snug">
        <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
          <Link href={`/plans/${plan.id}`} className="text-sm text-black underline underline-offset-4">Back to plan</Link>
          <PrintButton />
        </div>

        <header className="mb-4 border-b border-black pb-2">
          <h1 className="text-xl font-semibold">{plan.name}</h1>
          <p className="mt-0.5">
            {user.name ?? user.email} · {PLAN_STATUS_LABEL[plan.status]}{plan.isPrimary ? " · primary plan" : ""} · printed {printed}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 print:grid-cols-4">
          {[9, 10, 11, 12].map((g) => {
            const rows = entries.filter((e) => e.gradeLevel === g);
            return (
              <section key={g} className="break-inside-avoid">
                <h2 className="mb-1 border-b border-black pb-0.5 text-[13px] font-semibold">Grade {g}</h2>
                {rows.length === 0 ? (
                  <p>No courses</p>
                ) : (
                  <ul className="divide-y divide-neutral-400">
                    {rows.map((e) => (
                      <li key={e.id} className="py-1">
                        <span className="block font-medium">{e.name}</span>
                        <span className="block font-mono text-[11px]">
                          {formatCredits(e.credits)} cr · {STATUS[e.status]}{e.grade ? ` · ${e.grade}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 border-t border-black pt-0.5 font-mono text-[11px]">{formatCredits(sumCredits(rows.map((e) => e.credits)))} credits</p>
              </section>
            );
          })}
        </div>

        <section className="mt-6 break-inside-avoid">
          <h2 className="mb-1 border-b border-black pb-0.5 text-[13px] font-semibold">
            Graduation requirements · {formatCredits(summary.total)} of {formatCredits(summary.totalRequired)} credits
          </h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-500">
                <th className="py-0.5 pr-2 font-medium">Requirement</th>
                <th className="py-0.5 pr-2 text-right font-medium">Earned</th>
                <th className="py-0.5 pr-2 text-right font-medium">Planned</th>
                <th className="py-0.5 pr-2 text-right font-medium">Needed</th>
                <th className="py-0.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {summary.kinds.map((k) => (
                <tr key={k.kind} className="border-b border-neutral-300">
                  <td className="py-0.5 pr-2 font-sans">{k.label}</td>
                  <td className="py-0.5 pr-2 text-right">{formatCredits(k.earned)}</td>
                  <td className="py-0.5 pr-2 text-right">{formatCredits(k.scheduled)}</td>
                  <td className="py-0.5 pr-2 text-right">{formatCredits(k.required)}</td>
                  <td className="py-0.5 text-right font-sans">{k.met ? "met" : `${formatCredits(k.missing)} short`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.kinds.some((k) => k.provisional > 0) && <p className="mt-1">Some courses count toward requirements through tags a counselor has not confirmed yet.</p>}
        </section>

        <footer className="mt-6 border-t border-black pt-2">
          Self-reported and unofficial. This is a planning aid made by students, not a transcript or a placement. Course selection and graduation requirements are decided by the school. Not affiliated with Pascack Valley Regional High School District.
        </footer>
      </div>
    </div>
  );
}
