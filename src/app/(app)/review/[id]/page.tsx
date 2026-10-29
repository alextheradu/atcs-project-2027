export const instant = false;

import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/appeals/decision-form";
import { TONE } from "@/components/appeals/tone";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import { canReview, isDecidable, STATUS_LABEL, type AppealStatus } from "@/lib/appeals/rules";
import { gradeLabel } from "@/lib/plans/view";

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("SUPERVISOR", "ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const appeal = await db.appeal.findUnique({
    where: { id },
    include: { targetCourse: { select: { name: true, prereqText: true } }, answers: true, student: { select: { name: true, email: true } } },
  });
  // Another department's request looks like it does not exist.
  if (!appeal || !canReview(user, appeal.department) || appeal.status === "DRAFT") notFound();
  const status = appeal.status as AppealStatus;
  const unmet = (appeal.unmetRules as { message: string }[] | null) ?? [];

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title={appeal.targetCourse.name}
        description={`${DEPT_LABEL[appeal.department]} · ${appeal.student.name ?? appeal.student.email}`}
        back={{ href: "/review", label: "Reviews" }}
        badge={<Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>}
      />
      <div className="space-y-10">
        {appeal.targetCourse.prereqText && (
          <Section title="Requirement in the Program of Studies"><p className="max-w-[65ch] text-sm">{appeal.targetCourse.prereqText}</p></Section>
        )}
        {unmet.length > 0 && (
          <Section title="What was missing when they asked">
            <ul className="list">{unmet.map((u, i) => <li key={i} className="py-2 text-[13px]">{u.message}</li>)}</ul>
          </Section>
        )}
        <Section title="Their answers" description="Self-reported by the student. Check these against their records.">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone="warning">Self-reported</Badge>
            {appeal.reportedGrade && <>Grade <span className="num text-fg">{gradeLabel(appeal.reportedGrade)}</span></>}
            {appeal.reportedAverage !== null && <>Average <span className="num text-fg">{Number(appeal.reportedAverage)}</span></>}
          </p>
          <dl className="space-y-4">
            {appeal.answers.map((a) => (
              <div key={a.id}><dt className="text-xs text-muted">{a.prompt}</dt><dd className="mt-0.5 whitespace-pre-wrap text-sm">{a.answer}</dd></div>
            ))}
            {appeal.answers.length === 0 && <p className="text-[13px] text-muted">No answers were given.</p>}
          </dl>
        </Section>
        {isDecidable(status) ? (
          <Section title="Your decision"><DecisionForm appealId={appeal.id} status={status} /></Section>
        ) : (
          appeal.decisionNote && <Section title="Decision note"><p className="whitespace-pre-wrap text-sm">{appeal.decisionNote}</p></Section>
        )}
      </div>
    </div>
  );
}
