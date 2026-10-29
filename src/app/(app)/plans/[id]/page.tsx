export const instant = false;

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { PlanActions } from "@/components/planner/plan-actions";
import { Planner } from "@/components/planner/planner";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { getGraduationConfig } from "@/lib/requirements/config";
import { loadOwnedPlan, loadPickerCourses } from "@/lib/plans/load";
import { isEditable } from "@/lib/plans/schemas";
import { PLAN_STATUS_LABEL } from "@/lib/plans/view";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();

  const data = await loadOwnedPlan(id, user.id);
  if (!data) notFound();

  const [courses, interests, config, profile] = await Promise.all([
    loadPickerCourses(),
    db.interestTag.findMany({ orderBy: { label: "asc" }, select: { slug: true, label: true } }),
    getGraduationConfig(),
    db.studentProfile.findUnique({ where: { userId: user.id }, select: { eighthMath: true, eighthMathGrade: true } }),
  ]);
  const { plan, entries } = data;
  const editable = isEditable(plan.status);

  return (
    <div>
      <PageHeader
        title={plan.name}
        back={{ href: "/plans", label: "Plans" }}
        badge={
          <>
            {plan.isPrimary && <Badge tone="review">Primary</Badge>}
            {plan.status !== "DRAFT" && <Badge tone={plan.status === "APPROVED" ? "eligible" : plan.status === "CHANGES_REQUESTED" ? "warning" : "review"}>{PLAN_STATUS_LABEL[plan.status]}</Badge>}
          </>
        }
        actions={<PlanActions planId={plan.id} name={plan.name} isPrimary={plan.isPrimary} editable={editable} />}
      />
      <Planner plan={plan} entries={entries} courses={courses} interests={interests} rules={config.rules} settings={config.settings} prior={profile ?? {}} />
    </div>
  );
}
