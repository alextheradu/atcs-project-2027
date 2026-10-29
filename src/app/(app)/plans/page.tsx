export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";
import { NewPlanForm } from "@/components/planner/new-plan-form";
import { requirePageUser } from "@/lib/auth/page";
import { sumCredits, formatCredits } from "@/lib/credits";
import { db } from "@/lib/db";
import { getGraduationConfig } from "@/lib/requirements/config";
import { PLAN_STATUS_LABEL } from "@/lib/plans/view";

export default async function Plans() {
  const user = await requirePageUser();
  const [plans, { settings }] = await Promise.all([
    db.plan.findMany({
      where: { ownerId: user.id },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      include: { entries: { select: { credits: true } } },
    }),
    getGraduationConfig(),
  ]);

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Try different paths. One plan is your primary plan, the one counselors see."
        actions={plans.length > 0 ? <NewPlanForm /> : undefined}
      />

      {plans.length === 0 ? (
        <EmptyState
          title="You do not have a plan yet"
          description="A plan has four columns, one for each year of high school. You can start blank and add courses."
          action={<NewPlanForm label="Create Plan A" first />}
        />
      ) : (
        <ul className="list list-hover">
          {plans.map((p) => {
            const total = sumCredits(p.entries.map((e) => e.credits));
            return (
              <li key={p.id}>
                <Link href={`/plans/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.isPrimary && <Badge tone="review">Primary</Badge>}
                    {p.status !== "DRAFT" && <Badge tone={p.status === "APPROVED" ? "eligible" : p.status === "CHANGES_REQUESTED" ? "warning" : "review"}>{PLAN_STATUS_LABEL[p.status]}</Badge>}
                  </span>
                  <span className="num text-muted">
                    <span className="text-fg">{formatCredits(total)}</span> / {formatCredits(settings.totalRequired)} cr · {p.entries.length} courses
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
