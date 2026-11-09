export const instant = false;

import Link from "next/link";
import { TONE } from "@/components/appeals/tone";
import { UnreadNotes } from "@/components/board/notes";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type AppealStatus } from "@/lib/appeals/rules";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL } from "@/lib/catalog/labels";
import type { DemandSort } from "@/lib/counselor";
import { loadCounselor } from "@/lib/counselor/load";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

type Tab = "look" | "gaps" | "demand";
const date = (d: Date | null) => d?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "";

function Tabs({ tabs, active, keep }: { tabs: { key: Tab; label: string; count?: number }[]; active: Tab; keep: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Students view" className="mb-8 flex flex-wrap gap-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/students?tab=${t.key}${keep}`}
          aria-current={t.key === active ? "page" : undefined}
          className={cn("flex h-9 items-center gap-2 rounded-full px-4 text-[14px] transition-colors", t.key === active ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg")}
        >
          {t.label}
          {t.count ? <span className="num text-[13px] font-medium text-muted">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-muted">{children}</p>;
}

/** Staff home: what is waiting on you, which students have graduation gaps, and course demand. */
export default async function Students({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string; sort?: string; show?: string }> }) {
  const user = await requirePageRole("COUNSELOR", "SUPERVISOR", "ADMIN");
  const params = await searchParams;
  const plansRole = user.role === "COUNSELOR" || user.role === "ADMIN";
  const decides = user.role === "SUPERVISOR" || user.role === "ADMIN";
  const gradYear = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : undefined;
  const sort: DemandSort = params.sort === "name" ? "name" : "students";
  const showDecided = params.show === "done";

  // Supervisors only ever see their own departments. Admins see everything.
  const scope = user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {};
  const [data, appeals] = await Promise.all([
    plansRole ? loadCounselor({ gradYear, sort }) : null,
    decides
      ? db.appeal.findMany({
          where: { status: showDecided ? { in: ["APPROVED", "DENIED"] } : { in: ["SUBMITTED", "UNDER_REVIEW"] }, ...scope },
          orderBy: showDecided ? { decidedAt: "desc" } : { submittedAt: "asc" },
          take: 200,
          include: { targetCourse: { select: { name: true } } },
        })
      : [],
  ]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "look", label: "Needs a look", count: (data?.pending.length ?? 0) + (showDecided ? 0 : appeals.length) },
    ...(data ? [{ key: "gaps" as const, label: "Graduation gaps", count: data.offTrack.length }, { key: "demand" as const, label: "Course demand" }] : []),
  ];
  const tab: Tab = tabs.some((t) => t.key === params.tab) ? (params.tab as Tab) : "look";
  const keep = gradYear ? `&year=${gradYear}` : "";

  const yearFilter = data && (
    <form action="/students" className="mb-6 flex items-center gap-2 text-[14px]">
      <input type="hidden" name="tab" value={tab} />
      <label className="flex items-center gap-2">
        <span className="text-muted">Class of</span>
        <select className="input !w-auto" name="year" defaultValue={gradYear ?? ""}>
          <option value="">All classes</option>
          {data.gradYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <button className="btn btn-sm" type="submit">Show</button>
    </form>
  );

  return (
    <div className="max-w-[960px]">
      <header className="mb-4">
        <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">Students</h1>
      </header>
      <Tabs tabs={tabs} active={tab} keep={keep} />

      {tab === "look" && (
        <div className="space-y-10">
          <ul className="space-y-1.5 text-[14px] empty:hidden">
            <UnreadNotes userId={user.id} />
          </ul>

          {data && (
            <section>
              <h2 className="eyebrow mb-2">Plans sent for review</h2>
              {data.pending.length === 0 ? <Empty>Nothing waiting.</Empty> : (
                <ul className="list list-hover">
                  {data.pending.map((p) => (
                    <li key={p.id}>
                      <Link href={`/counselor/plans/${p.id}`} className="flex items-center justify-between gap-4 py-2.5 text-[15px]">
                        <span className="font-medium">{p.student}</span>
                        <span className="num text-[14px] text-muted">sent {date(p.submittedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {decides && (
            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="eyebrow">{showDecided ? "Decided placement reviews" : "Placement reviews to decide"}</h2>
                <Link href={showDecided ? "/students?tab=look" : "/students?tab=look&show=done"} className="text-[14px] font-medium text-accent-ink hover:underline">
                  {showDecided ? "Show open reviews" : "Show decided reviews"}
                </Link>
              </div>
              {user.role === "SUPERVISOR" && <p className="mb-2 text-[14px] text-muted">For classes in your departments.</p>}
              {appeals.length === 0 ? <Empty>{showDecided ? "No decisions yet." : "Nothing waiting."}</Empty> : (
                <ul className="list list-hover">
                  {appeals.map((a) => (
                    <li key={a.id}>
                      <Link href={`/review/${a.id}`} className="flex items-center justify-between gap-4 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-medium">{a.targetCourse.name}</span>
                          <span className="block text-[13px] text-muted">{DEPT_LABEL[a.department]}{a.submittedAt ? `, sent ${date(a.submittedAt)}` : ""}</span>
                        </span>
                        <Badge tone={TONE[a.status as AppealStatus]}>{STATUS_LABEL[a.status as AppealStatus]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "gaps" && data && (
        <section>
          {yearFilter}
          <p className="mb-4 max-w-[65ch] text-[14px] text-muted">
            {data.offTrack.length} of {data.scanned} students have something open. A board counts finished and planned classes, so younger students start with gaps.
          </p>
          {data.offTrack.length === 0 ? <Empty>Every board covers graduation.</Empty> : (
            <ul className="list list-hover">
              {data.offTrack.slice(0, 100).map((s) => (
                <li key={s.planId}>
                  <Link href={`/counselor/plans/${s.planId}`} className="block py-3">
                    <span className="flex items-baseline justify-between gap-4 text-[15px]">
                      <span className="font-medium">{s.student}{s.gradYear ? <span className="font-normal text-muted">, class of {s.gradYear}</span> : null}</span>
                      <span className="num text-[14px] text-muted">{s.total} of {s.required} cr</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{s.reasons.slice(0, 3).join(". ")}{s.reasons.length > 3 ? `. And ${s.reasons.length - 3} more.` : "."}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "demand" && data && (
        <section>
          {yearFilter}
          <p className="mb-3 max-w-[65ch] text-[14px] text-muted">How many students put each class on their board, by grade.</p>
          <div className="mb-3 flex gap-1 text-[14px]">
            {(["students", "name"] as const).map((s) => (
              <Link
                key={s}
                href={`/students?tab=demand&sort=${s}${keep}`}
                className={cn("rounded-full px-3 py-1.5", sort === s ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg")}
              >
                {s === "students" ? "Most students" : "Name"}
              </Link>
            ))}
          </div>
          {data.demand.length === 0 ? <Empty>No boards yet.</Empty> : (
            <ul className="list">
              {data.demand.slice(0, 200).map((d) => (
                <li key={d.courseId} className="flex items-center justify-between gap-4 py-2 text-[15px]">
                  <span className="min-w-0 truncate">{d.name}</span>
                  <span className="num shrink-0 text-[14px] text-muted">
                    {[9, 10, 11, 12].filter((g) => d.byGrade[g]).map((g) => `${g}th: ${d.byGrade[g]}`).join(", ")}
                    <span className="ml-4 font-semibold text-fg">{d.students}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
