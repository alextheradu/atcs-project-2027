export const instant = false;

import Link from "next/link";
import { TONE } from "@/components/appeals/tone";
import { NewPlanForm } from "@/components/planner/new-plan-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";
import { STATUS_LABEL, type AppealStatus } from "@/lib/appeals/rules";
import { requirePageUser } from "@/lib/auth/page";
import { formatCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { loadOwnedPlan } from "@/lib/plans/load";
import { PLAN_STATUS_LABEL, toTracked } from "@/lib/plans/view";
import { summarize, type GraduationSummary } from "@/lib/requirements";
import { getGraduationConfig } from "@/lib/requirements/config";
import { countdownText, upcoming } from "@/lib/timeline";

const GRADES = [9, 10, 11, 12];
const OPEN = { in: ["SUBMITTED", "UNDER_REVIEW"] as ("SUBMITTED" | "UNDER_REVIEW")[] };

/** Lists here carry their own top rule, so a block only needs a label. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="eyebrow mb-3">{title}</h2>
      {children}
    </section>
  );
}

/** The one sentence a student came here for, then what is behind it. */
function headline(s: GraduationSummary): { title: string; detail: string } {
  if (s.complete) return { title: "On track for graduation", detail: "Every requirement is covered by completed or planned courses." };
  const left = s.missingList;
  if (left.length === 0) {
    return { title: `${formatCredits(s.missing)} credits left`, detail: "Each subject is covered. Add electives to reach the total." };
  }
  const named = left.slice(0, 4).map((m) => `${m.label} ${formatCredits(m.missing)}`);
  const more = left.length > 4 ? `, and ${left.length - 4} more` : "";
  return {
    title: `${left.length} ${left.length === 1 ? "requirement" : "requirements"} left`,
    detail: `Still needed: ${named.join(", ")}${more}.`,
  };
}

export default async function Dashboard() {
  const user = await requirePageUser();
  const nav = navFor(user.role);
  const has = (href: string) => nav.some((n) => n.href === href);

  const [primaryId, events, appeals, toReview, plansToReview] = await Promise.all([
    db.plan.findFirst({ where: { ownerId: user.id }, orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }], select: { id: true } }),
    db.timelineEvent.findMany({ orderBy: { opensAt: "asc" } }),
    has("/appeals")
      ? db.appeal.findMany({
          where: { studentId: user.id, status: OPEN },
          orderBy: { submittedAt: "asc" },
          take: 5,
          include: { targetCourse: { select: { name: true } } },
        })
      : [],
    has("/review")
      ? db.appeal.count({ where: { status: OPEN, ...(user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {}) } })
      : 0,
    has("/counselor") ? db.plan.count({ where: { status: "SUBMITTED" } }) : 0,
  ]);
  const [data, config] = await Promise.all([primaryId ? loadOwnedPlan(primaryId.id, user.id) : null, getGraduationConfig()]);
  const summary = data ? summarize(data.entries.map(toTracked), config.rules, config.settings) : null;
  const next = upcoming(events.map((e) => ({ ...e, audience: e.audience as "CURRENT" | "INCOMING" | "ALL" })), user.role);
  const staff = [
    has("/review") && { href: "/review", label: "Placement reviews waiting", count: toReview },
    has("/counselor") && { href: "/counselor", label: "Plans sent for review", count: plansToReview },
  ].filter((x): x is { href: string; label: string; count: number } => !!x);

  const head = summary ? headline(summary) : null;

  return (
    <div className="space-y-12">
      {data && head ? (
        <PageHeader
          title={head.title}
          description={head.detail}
          badge={summary?.complete ? <Badge tone="eligible">Complete</Badge> : undefined}
          actions={<Link className="btn btn-primary" href={`/plans/${data.plan.id}`}>Open {data.plan.name}</Link>}
        />
      ) : (
        <PageHeader title={`Hi${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} description="Start with a plan. Everything else here is built from it." />
      )}

      {staff.length > 0 && (
        <Block title="Waiting on you">
          <ul className="list list-hover">
            {staff.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex items-baseline justify-between gap-6 py-3 text-[13px]">
                  <span>{s.label}</span>
                  <span className={s.count > 0 ? "num text-fg" : "num text-muted"}>{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {has("/plans") && !data && (
        <EmptyState
          title="You do not have a plan yet"
          description="A plan has four columns, one for each year of high school. The requirements fill in as you add courses."
          action={<NewPlanForm label="Create Plan A" first />}
        />
      )}

      {data && summary && (
        <Block title={data.plan.isPrimary ? `${data.plan.name}, primary plan` : data.plan.name}>
          {data.plan.status !== "DRAFT" && (
            <p className="mb-4 text-[13px] text-muted">
              {PLAN_STATUS_LABEL[data.plan.status]}.{data.plan.status === "SUBMITTED" ? " The plan is read-only while a counselor looks at it." : ""}
            </p>
          )}
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {GRADES.map((g) => {
              const rows = data.entries.filter((e) => e.gradeLevel === g);
              const year = summary.years.find((y) => y.grade === g);
              return (
                <div key={g}>
                  <div className="flex items-baseline justify-between pb-2">
                    <span className="eyebrow">Grade {g}</span>
                    <span className="num text-muted">{formatCredits(year?.total ?? 0)} cr</span>
                  </div>
                  <ul className="list text-[13px]">
                    {rows.length === 0 ? (
                      <li className="py-2 text-muted">No courses yet</li>
                    ) : (
                      rows.map((e) => (
                        <li key={e.id} className="flex items-baseline justify-between gap-3 py-2">
                          <span className="truncate">{e.name}</span>
                          <span className="num text-muted">{formatCredits(e.credits)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[13px] text-muted">
            <span className="num text-fg">{formatCredits(summary.total)}</span> of <span className="num">{formatCredits(summary.totalRequired)}</span> credits, counting completed and planned courses.
          </p>
        </Block>
      )}

      {appeals.length > 0 && (
        <Block title="Your placement reviews">
          <ul className="list list-hover">
            {appeals.map((a) => (
              <li key={a.id}>
                <Link href={`/appeals/${a.id}`} className="flex items-center justify-between gap-4 py-3 text-[13px]">
                  <span className="truncate">{a.targetCourse.name}</span>
                  <Badge tone={TONE[a.status as AppealStatus]}>{STATUS_LABEL[a.status as AppealStatus]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {next.length > 0 && (
        <Block title="Coming up">
          <ul className="list">
            {next.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-6 py-2.5 text-[13px]">
                <span>{u.label}</span>
                <span className="num text-muted">{countdownText(u)}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}
