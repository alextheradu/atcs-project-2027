export const instant = false;

import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { loadCounselor } from "@/lib/counselor/load";
import type { DemandSort } from "@/lib/counselor";

export default async function Counselor({ searchParams }: { searchParams: Promise<{ year?: string; sort?: string }> }) {
  await requirePageRole("COUNSELOR", "ADMIN");
  const { year, sort } = await searchParams;
  const gradYear = /^\d{4}$/.test(year ?? "") ? Number(year) : undefined;
  const by: DemandSort = sort === "name" ? "name" : "students";
  const data = await loadCounselor({ gradYear, sort: by });
  const q = (extra: Record<string, string>) => `/counselor?${new URLSearchParams({ ...(gradYear ? { year: String(gradYear) } : {}), ...extra })}`;

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Counselor" description="Plans waiting for review, students whose plans leave graduation open, and how many students planned each course." />

      <form action="/counselor" className="mb-10 flex items-center gap-2 text-[13px]">
        <label className="flex items-center gap-2"><span className="text-muted">Class of</span>
          <select className="input !w-auto" name="year" defaultValue={gradYear ?? ""}>
            <option value="">All classes</option>
            {data.gradYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button className="btn btn-sm" type="submit">Filter</button>
      </form>

      <div className="space-y-12">
        <Section title="Plans to review" description={`${data.pending.length} waiting`}>
          {data.pending.length === 0 ? <p className="text-[13px] text-muted">Nothing waiting.</p> : (
            <ul className="list list-hover">
              {data.pending.map((p) => (
                <li key={p.id}>
                  <Link href={`/counselor/plans/${p.id}`} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
                    <span><span className="font-medium">{p.student}</span> <span className="text-muted">· {p.name}</span></span>
                    <span className="num text-muted">{p.submittedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Plans that leave graduation open" description={`${data.offTrack.length} of ${data.scanned} primary plans. A plan counts completed and planned courses, so younger students start with open requirements.`}>
          {data.offTrack.length === 0 ? <p className="text-[13px] text-muted">Every primary plan covers graduation.</p> : (
            <ul className="list list-hover">
              {data.offTrack.slice(0, 100).map((s) => (
                <li key={s.planId}>
                  <Link href={`/counselor/plans/${s.planId}`} className="block py-3">
                    <span className="flex items-baseline justify-between gap-4 text-[13px]">
                      <span className="font-medium">{s.student}{s.gradYear ? <span className="font-normal text-muted"> · class of {s.gradYear}</span> : null}</span>
                      <span className="num text-muted">{s.total} / {s.required} cr</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{s.reasons.slice(0, 3).join(" · ")}{s.reasons.length > 3 ? ` · and ${s.reasons.length - 3} more` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Course demand" description="Students who planned each course, counting primary plans and plans sent for review or approved. Drafts that are not primary are left out.">
          <div className="mb-2 flex gap-4 text-[13px]">
            <Link href={q({ sort: "students" })} className={by === "students" ? "text-fg" : "text-muted hover:text-fg"}>Most students</Link>
            <Link href={q({ sort: "name" })} className={by === "name" ? "text-fg" : "text-muted hover:text-fg"}>Name</Link>
          </div>
          {data.demand.length === 0 ? <p className="text-[13px] text-muted">No plans yet.</p> : (
            <ul className="list">
              {data.demand.slice(0, 200).map((d) => (
                <li key={d.courseId} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                  <span className="min-w-0 truncate">{d.name}</span>
                  <span className="num shrink-0 text-muted">
                    {[9, 10, 11, 12].filter((g) => d.byGrade[g]).map((g) => `${g}th ${d.byGrade[g]}`).join("  ")}
                    <span className="ml-4 text-fg">{d.students}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
