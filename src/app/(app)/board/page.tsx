export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { Board } from "@/components/board/board";
import { StudentNotes, UnreadNotes } from "@/components/board/notes";
import { StartBoard } from "@/components/board/start-board";
import { SpecialCases } from "@/components/board/special-cases";
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
import { cn } from "@/lib/utils";

function BoardTabs({ specialCases = false }: { specialCases?: boolean }) {
  return (
    <nav aria-label="Board view" className="mb-6 flex gap-1">
      {[
        { href: "/board", label: "Plan", active: !specialCases },
        { href: "/board?view=special-cases", label: "Special cases", active: specialCases },
      ].map(({ href, label, active }) => (
        <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn(
          "flex h-9 items-center rounded-full px-4 text-[14px] transition-colors",
          active ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg",
        )}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** The student's one plan. The primary plan if there is one, otherwise their most recent. */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ tour?: string; view?: string }> }) {
  const user = await requirePageUser();
  if (!canUseStudentWorkspace(user.role)) redirect(homeFor(user.role));
  const { tour, view } = await searchParams;

  if (view === "special-cases") {
    return (
      <div>
        <h1 className="mb-4 text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">My board</h1>
        <BoardTabs specialCases />
        <SpecialCases studentName={user.name} />
      </div>
    );
  }

  const planId = await boardPlanId(user.id);
  const data = planId ? await loadOwnedPlan(planId, user.id) : null;

  if (!data) {
    return (
      <div>
        <h1 className="mb-4 text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">My board</h1>
        <BoardTabs />
        <EmptyState
          title="Your board is empty"
          description="Start one to see what you need to graduate."
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
        navigation={<BoardTabs />}
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
