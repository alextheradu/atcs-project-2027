export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { Board } from "@/components/board/board";
import { ReviewPanel } from "@/components/plan-review/review-panel";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { loadGuidance } from "@/lib/guidance/load";
import { loadComments } from "@/lib/plan-review/load";
import { loadPickerCourses, loadPlanForReview } from "@/lib/plans/load";
import { PLAN_STATUS_LABEL } from "@/lib/plans/view";
import { getGraduationConfig } from "@/lib/requirements/config";

/** Read-only view of any student's board for counselors and admins. */
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
    db.studentProfile.findUnique({ where: { userId: plan.ownerId }, select: { eighthMath: true, eighthMathGrade: true, intendedMajor: true, gradYear: true, currentGrade: true } }),
    loadComments(id),
    loadGuidance(),
  ]);
  const student = owner?.name ?? owner?.email ?? "Student";
  const about = [profile?.gradYear ? `Class of ${profile.gradYear}` : null, profile?.intendedMajor ? `interested in ${profile.intendedMajor}` : null].filter(Boolean).join(", ");

  return (
    <div className="space-y-12">
      <div>
        <Link href="/students" className="mb-3 inline-block text-[14px] text-muted transition-colors hover:text-fg">← Students</Link>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-[14px] text-muted">
          <Badge tone={plan.status === "APPROVED" ? "eligible" : plan.status === "CHANGES_REQUESTED" ? "warning" : plan.status === "SUBMITTED" ? "review" : "neutral"}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
          {about && <span>{about}</span>}
        </div>
        <Board
          title={`${student}'s board`}
          plan={plan} entries={entries} courses={courses} interests={interests} rules={config.rules} settings={config.settings}
          prior={profile ?? {}} currentGrade={profile?.currentGrade ?? null} readOnly
          guidance={{ config: guidanceConfig, intendedMajor: profile?.intendedMajor ?? null }}
        />
      </div>
      <ReviewPanel planId={plan.id} status={plan.status} isOwner={false} canReview comments={comments} entries={entries.map((e) => ({ id: e.id, name: e.name }))} />
    </div>
  );
}
