export const instant = false;

import { redirect } from "next/navigation";
import { Board } from "@/components/board/board";
import { StudentNotes, UnreadNotes } from "@/components/board/notes";
import { StartBoard } from "@/components/board/start-board";
import { ReviewPanel } from "@/components/plan-review/review-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePageUser } from "@/lib/auth/page";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { db } from "@/lib/db";
import { loadGuidance } from "@/lib/guidance/load";
import { homeFor } from "@/lib/nav";
import { loadComments } from "@/lib/plan-review/load";
import { boardPlanId, loadOwnedPlan, loadPickerCourses } from "@/lib/plans/load";
import { getGraduationConfig } from "@/lib/requirements/config";

/** The student's one plan. The primary plan if there is one, otherwise their most recent. */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const user = await requirePageUser();
  if (!canUseStudentWorkspace(user.role)) redirect(homeFor(user.role));
  const { tour } = await searchParams;

  const planId = await boardPlanId(user.id);
  const data = planId ? await loadOwnedPlan(planId, user.id) : null;

  if (!data) {
    return (
      <div>
        <h1 className="mb-6 text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">My board</h1>
        <EmptyState
          title="Your board is empty"
          description="It has a row for each subject and a column for each year of high school. Empty spots show what you need to graduate."
          action={<StartBoard />}
        />
      </div>
    );
  }

  const [courses, interests, config, profile, guidanceConfig, comments] = await Promise.all([
    loadPickerCourses(),
    db.interestTag.findMany({ orderBy: { label: "asc" }, select: { slug: true, label: true } }),
    getGraduationConfig(),
    db.studentProfile.findUnique({ where: { userId: user.id }, select: { eighthMath: true, eighthMathGrade: true, intendedMajor: true, currentGrade: true } }),
    loadGuidance(),
    loadComments(data.plan.id),
  ]);
  const { plan, entries } = data;

  return (
    <div>
      <Board
        title="My board"
        plan={plan}
        entries={entries}
        courses={courses}
        interests={interests}
        rules={config.rules}
        settings={config.settings}
        prior={profile ?? {}}
        currentGrade={profile?.currentGrade ?? null}
        guidance={{ config: guidanceConfig, intendedMajor: profile?.intendedMajor ?? null }}
        tour={tour === "1"}
        footer={<ReviewPanel planId={plan.id} status={plan.status} isOwner canReview={false} comments={comments} entries={entries.map((e) => ({ id: e.id, name: e.name }))} />}
        notes={
          <>
            <UnreadNotes userId={user.id} />
            <StudentNotes userId={user.id} role={user.role} />
          </>
        }
      />
    </div>
  );
}
