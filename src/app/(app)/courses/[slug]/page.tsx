export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { StartAppealButton } from "@/components/appeals/start-button";
import { AddToBoardButton } from "@/components/catalog/add-to-board-button";
import { CourseFitList } from "@/components/eligibility/course-fit";
import { Badge } from "@/components/ui/badge";
import { Dl } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { ROWS, rowFor } from "@/lib/board";
import { DEPT_LABEL, KIND_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import { canTakeAnswer, courseFit, parseRule, ruleSlugs, type PlanCourse } from "@/lib/eligibility";
import { boardPlanId } from "@/lib/plans/load";
import { isEditable } from "@/lib/plans/schemas";
import type { RequirementKind } from "@/lib/requirements";
import { describeRule } from "@/lib/rules/describe";
import { cn } from "@/lib/utils";

const APPEAL_STATE: Record<string, string> = {
  DRAFT: "is not sent yet.", SUBMITTED: "was sent and is waiting.", UNDER_REVIEW: "is being reviewed.",
  APPROVED: "was approved.", DENIED: "was not approved. Open it to read why.",
};
const DOT = { eligible: "bg-green", warning: "bg-yellow", appeal: "bg-orange", locked: "bg-red" } as const;

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePageUser();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) notFound();
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      requirements: true,
      interests: true,
      edgesTo: { include: { from: { select: { slug: true, name: true, archived: true } } } },
      edgesFrom: { include: { to: { select: { slug: true, name: true, archived: true } } } },
    },
  });
  if (!course || (course.archived && user.role !== "COUNSELOR" && user.role !== "ADMIN")) notFound();
  const canEdit = user.role === "COUNSELOR" || user.role === "ADMIN";
  const student = canUseStudentWorkspace(user.role);

  // Check the class against the student's Board. Staff have no Board, so they see the requirement text only.
  const rules = parseRule(course.rules);
  const planId = student ? await boardPlanId(user.id) : null;
  const plan = planId
    ? await db.plan.findUnique({ where: { id: planId }, include: { entries: { include: { course: { select: { slug: true, name: true } } } } } })
    : null;
  const wanted = rules ? ruleSlugs(rules) : [];
  const nameRows = wanted.length ? await db.course.findMany({ where: { slug: { in: wanted } }, select: { slug: true, name: true } }) : [];
  const names = Object.fromEntries(nameRows.map((c) => [c.slug, c.name]));
  const profile = plan ? await db.studentProfile.findUnique({ where: { userId: user.id }, select: { eighthMath: true, eighthMathGrade: true, currentGrade: true } }) : null;
  const placements: PlanCourse[] = (plan?.entries ?? []).map((e) => ({
    key: e.id, slug: e.course.slug, name: e.course.name, gradeLevel: e.gradeLevel, status: e.status, grade: e.grade,
    rules: null, prereqText: null, approvedAppeal: e.overrideAppealId !== null,
  }));
  // The student's most recent placement review for this class, so the page can point back to it.
  const appeal = student
    ? await db.appeal.findFirst({ where: { studentId: user.id, targetCourseId: course.id, status: { not: "WITHDRAWN" } }, orderBy: { updatedAt: "desc" }, select: { id: true, status: true } })
    : null;
  const approved = appeal?.status === "APPROVED";
  // Every class gets an answer once there is a Board; a class with no listed rule is checked by grade alone.
  const fits = plan ? courseFit({ slug: course.slug, gradesOffered: course.gradesOffered, rules, prereqText: course.prereqText }, placements, { prior: profile ?? {}, names, approved }) : [];
  const answer = canTakeAnswer(fits, { approved, currentGrade: profile?.currentGrade ?? null });
  // Offer a review when no grade qualifies outright but at least one is close enough to ask about, and none is open already.
  const openAppeal = appeal && ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(appeal.status);
  const canAsk = fits.length > 0 && !approved && !openAppeal && !fits.some((f) => f.result.status === "ELIGIBLE") && fits.some((f) => f.result.status === "NOT_ELIGIBLE_APPEALABLE" || f.result.status === "ELIGIBLE_WITH_WARNING");

  const onBoard = plan?.entries.find((e) => e.courseId === course.id);
  const grades = course.gradesOffered.filter((g) => g >= 9 && g <= 12);
  const canAdd = !!plan && isEditable(plan.status) && !onBoard && !course.archived && course.plannable && grades.length > 0;
  const tags = course.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional }));
  const row = ROWS.find((r) => r.key === rowFor(tags))!;
  const leadsFrom = course.edgesTo.filter((e) => !e.from.archived);
  const leadsTo = course.edgesFrom.filter((e) => !e.to.archived);

  return (
    <article className="max-w-[880px]">
      <Link href="/courses" className="mb-3 inline-block text-[14px] text-muted transition-colors hover:text-fg">← Classes</Link>
      <header className={cn("mb-6", `subject-${row.key}`)}>
        <p className="ink text-[14px] font-semibold">{DEPT_LABEL[course.department]}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.025em]">{course.name}</h1>
          {course.archived && <Badge tone="locked">Archived</Badge>}
        </div>
        <p className="mt-1 text-[15px] text-muted">
          {LEVEL_LABEL[course.level]}, <span className="num">{fmtCredits(course.credits)}</span> credits, {course.duration === "HALF" ? "half year" : "full year"}
          {grades.length > 0 && <>, grades <span className="num">{grades.join(", ")}</span></>}
        </p>
      </header>

      {student && !plan && (
        <p className="mb-6 text-[15px] text-muted">
          <Link href="/board" className="font-medium text-accent-ink hover:underline">Start your board</Link> to see if you can take this.
        </p>
      )}
      {answer && (
        <div className="soft mb-6 p-5">
          <p className="flex items-start gap-3 text-[18px] font-semibold leading-snug">
            <span aria-hidden className={cn("mt-[7px] size-2.5 shrink-0 rounded-full", DOT[answer.tone])} />
            {answer.text}
          </p>
          {answer.detail && <p className="mt-1.5 pl-[22px] text-[15px] text-muted">{answer.detail}</p>}
        </div>
      )}

      {appeal && (
        <p className="mb-4 text-[15px]">
          <Link href={`/appeals/${appeal.id}`} className="font-medium text-accent-ink hover:underline">Your placement review</Link>
          <span className="text-muted"> for this class {APPEAL_STATE[appeal.status]}</span>
        </p>
      )}

      {(canAdd || onBoard || canAsk || canEdit) && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {canAdd && plan && (
            <AddToBoardButton planId={plan.id} courseId={course.id} grades={grades} suggested={Math.max(9, Math.min(12, (profile?.currentGrade ?? 8) + 1))} />
          )}
          {onBoard && (
            <p className="text-[15px]">
              On your board in {onBoard.gradeLevel}th grade. <Link href="/board" className="font-medium text-accent-ink hover:underline">Open my board</Link>
            </p>
          )}
          {canAsk && <StartAppealButton slug={course.slug} className="btn" />}
          {canEdit && <Link className="btn btn-ghost" href={`/admin/catalog/${course.id}`}>Edit in catalog</Link>}
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-[1fr_260px]">
        <div className="space-y-8">
          {course.description && <p className="max-w-[65ch] text-[15px] leading-relaxed">{course.description}</p>}

          {course.requirements.length > 0 && (
            <section>
              <h2 className="eyebrow mb-2">Counts toward graduation</h2>
              <ul className="flex flex-wrap gap-2">
                {course.requirements.map((r) => {
                  const key = ROWS.find((x) => x.kinds.includes(r.kind as RequirementKind))?.key ?? "elective";
                  return (
                    <li key={r.id} className={cn("rounded-full bg-[var(--tile-fill)] px-3 py-1.5 text-[14px]", `subject-${key}`)}>
                      <span className="ink font-semibold">{KIND_LABEL[r.kind]}</span> <span className="num">{fmtCredits(r.credits)}</span> cr
                      {r.provisional && <span className="text-muted">, not confirmed yet</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(course.prereqText || rules) && (
            <section>
              <h2 className="eyebrow mb-1">What it takes</h2>
              <p className="mb-3 text-[14px] text-muted">From the Program of Studies. The school decides placement.</p>
              <p className="max-w-[65ch] text-[15px] leading-relaxed">{course.prereqText || (rules ? describeRule(rules, names) : null)}</p>
            </section>
          )}

          {fits.length > 1 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[14px] font-medium text-accent-ink hover:underline [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Check each grade</span>
                <span className="hidden group-open:inline">Hide the grade by grade check</span>
              </summary>
              <div className="mt-3"><CourseFitList fits={fits} /></div>
            </details>
          )}

          {(leadsFrom.length > 0 || leadsTo.length > 0) && (
            <section>
              <h2 className="eyebrow mb-2">Pathway</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {leadsFrom.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[14px] text-muted">Usually comes after</p>
                    <ul className="space-y-1">
                      {leadsFrom.map((e) => <li key={e.id}><Link href={`/courses/${e.from.slug}`} className="text-[15px] font-medium hover:text-accent-ink">{e.from.name}</Link></li>)}
                    </ul>
                  </div>
                )}
                {leadsTo.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[14px] text-muted">Leads to</p>
                    <ul className="space-y-1">
                      {leadsTo.map((e) => <li key={e.id}><Link href={`/courses/${e.to.slug}`} className="text-[15px] font-medium hover:text-accent-ink">{e.to.name}</Link></li>)}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {course.dualEnrollment && (
            <section>
              <h2 className="eyebrow mb-1">Dual enrollment</h2>
              <p className="text-[15px] text-muted">{course.dualEnrollmentNote || "Dual enrollment is available. Ask your counselor about college credit and registration."}</p>
            </section>
          )}
        </div>

        <aside>
          <Dl
            items={[
              { label: "Department", value: DEPT_LABEL[course.department] },
              { label: "Level", value: LEVEL_LABEL[course.level] },
              { label: "Length", value: course.duration === "HALF" ? "Half year" : "Full year" },
              { label: "Credits", value: <span className="num">{fmtCredits(course.credits)}</span> },
              { label: "Grades", value: <span className="num">{course.gradesOffered.join(", ")}</span> },
              ...(course.sourcePage ? [{ label: "Program of Studies", value: <span className="num">p. {course.sourcePage}</span> }] : []),
              ...(course.interests.length ? [{ label: "Interests", value: course.interests.map((i) => i.label).join(", ") }] : []),
            ]}
          />
        </aside>
      </div>
    </article>
  );
}
