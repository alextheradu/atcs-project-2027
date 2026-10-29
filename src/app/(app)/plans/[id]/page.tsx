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

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tour?: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const { tour } = await searchParams;
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
      {plan.name.includes("starter draft") && (
        <p className="mb-6 border-y border-line py-3 text-[13px] text-muted">
          Based on self-reported info. This is a draft, not a placement. A supervisor decides your real courses.
        </p>
      )}
      {tour === "1" && (
        <aside aria-label="Quick tour" className="mb-8 border-y border-line py-4 text-[13px]">
          <p className="font-medium">A quick look around</p>
          <ul className="mt-2 grid gap-1 text-muted sm:grid-cols-2">
            <li>Four columns, one per grade. Drag a course to move it, or use Move to grade.</li>
            <li>Click a course row to set its status, grade and credits.</li>
            <li>The right side shows credits against graduation requirements.</li>
            <li>Badges show if you meet a course&apos;s requirements. Pathways shows the full steps.</li>
          </ul>
        </aside>
      )}
      <Planner plan={plan} entries={entries} courses={courses} interests={interests} rules={config.rules} settings={config.settings} prior={profile ?? {}} />
    </div>
  );
}
