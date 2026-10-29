export const instant = false;

import { notFound } from "next/navigation";
import { ReviewPanel } from "@/components/plan-review/review-panel";
import { Planner } from "@/components/planner/planner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { loadGuidance } from "@/lib/guidance/load";
import { loadComments } from "@/lib/plan-review/load";
import { loadPickerCourses, loadPlanForReview } from "@/lib/plans/load";
import { PLAN_STATUS_LABEL } from "@/lib/plans/view";
import { getGraduationConfig } from "@/lib/requirements/config";

/** Read-only view of any student's plan for counselors and admins. */
export default async function CounselorPlan({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("COUNSELOR", "ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const data = await loadPlanForReview(id);
  if (!data) notFound();
  const { plan, entries } = data;

  const [courses, interests, config, owner, profile, comments, guidanceConfig] = await Promise.all([
    loadPickerCourses(),
    db.interestTag.findMany({ select: { slug: true, label: true } }),
    getGraduationConfig(),
    db.user.findUnique({ where: { id: plan.ownerId }, select: { name: true, email: true } }),
    db.studentProfile.findUnique({ where: { userId: plan.ownerId }, select: { eighthMath: true, eighthMathGrade: true, intendedMajor: true, gradYear: true } }),
    loadComments(id),
    loadGuidance(),
  ]);

  return (
    <div>
      <PageHeader
        title={plan.name}
        description={`${owner?.name ?? owner?.email ?? "Student"}${profile?.gradYear ? ` · class of ${profile.gradYear}` : ""}${profile?.intendedMajor ? ` · interested in ${profile.intendedMajor}` : ""}`}
        back={{ href: "/counselor", label: "Counselor" }}
        badge={<>
          {plan.isPrimary && <Badge tone="review">Primary</Badge>}
          <Badge tone={plan.status === "APPROVED" ? "eligible" : plan.status === "CHANGES_REQUESTED" ? "warning" : plan.status === "SUBMITTED" ? "review" : "neutral"}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
        </>}
      />
      <Planner
        plan={plan} entries={entries} courses={courses} interests={interests} rules={config.rules} settings={config.settings}
        prior={profile ?? {}} readOnly guidance={{ config: guidanceConfig, intendedMajor: profile?.intendedMajor ?? null }}
      />
      <ReviewPanel planId={plan.id} status={plan.status} isOwner={false} canReview comments={comments} entries={entries.map((e) => ({ id: e.id, name: e.name }))} />
    </div>
  );
}
