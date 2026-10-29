export const instant = false;

import { notFound } from "next/navigation";
import { AppealForm, WithdrawButton, type FormQuestion } from "@/components/appeals/appeal-form";
import { TONE } from "@/components/appeals/tone";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { STUDENT_WORKSPACE_ROLES } from "@/lib/auth/student-access";
import { db } from "@/lib/db";
import { checkWindow, isEditable, isWithdrawable, STATUS_LABEL, type AppealStatus, type WindowEvent } from "@/lib/appeals/rules";
import { gradeLabel } from "@/lib/plans/view";

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(...STUDENT_WORKSPACE_ROLES);
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  // Ownership is part of the query: someone else's request is a 404.
  const appeal = await db.appeal.findFirst({
    where: { id, studentId: user.id },
    include: { targetCourse: { select: { name: true, slug: true } }, answers: true },
  });
  if (!appeal) notFound();
  const status = appeal.status as AppealStatus;
  const unmet = (appeal.unmetRules as { message: string }[] | null) ?? [];

  let form: React.ReactNode = null;
  if (isEditable(status)) {
    const [questions, events] = await Promise.all([
      db.appealQuestion.findMany({ where: { active: true, OR: [{ department: null }, { department: appeal.department }] }, orderBy: [{ sortOrder: "asc" }, { prompt: "asc" }] }),
      db.timelineEvent.findMany({ where: { kind: "APPEAL_WINDOW" } }),
    ]);
    const check = checkWindow(user.role === "INCOMING" ? "INCOMING" : "STUDENT", events.map((e) => ({ ...e, audience: e.audience as WindowEvent["audience"] })));
    const blocked = check.allowed ? null : check.nextOpen
      ? `Requests for incoming students open on ${check.nextOpen.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. You can save a draft now.`
      : "Requests for incoming students are not open yet. You can save a draft now, and the dates will show here when they are set.";
    const list: FormQuestion[] = questions.map((q) => ({ id: q.id, prompt: q.prompt, helpText: q.helpText, type: q.type, options: Array.isArray(q.options) ? (q.options as string[]) : [], required: q.required }));
    form = (
      <AppealForm
        appealId={appeal.id}
        questions={list}
        initialAnswers={Object.fromEntries(appeal.answers.filter((a) => a.questionId).map((a) => [a.questionId as string, a.answer]))}
        reportedGrade={appeal.reportedGrade}
        reportedAverage={appeal.reportedAverage === null ? null : Number(appeal.reportedAverage)}
        blocked={blocked}
      />
    );
  }

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title={appeal.targetCourse.name}
        description="Placement review request"
        back={{ href: "/appeals", label: "Requests" }}
        badge={<Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>}
      />
      <div className="space-y-10">
        {unmet.length > 0 && (
          <Section title="What you were missing" description="Saved when you started. You can still send the request.">
            <ul className="list">{unmet.map((u, i) => <li key={i} className="py-2 text-[13px]">{u.message}</li>)}</ul>
          </Section>
        )}

        {form ?? (
          <>
            <Section title="Your answers" description="Self-reported. A supervisor checks these against your records.">
              {(appeal.reportedGrade || appeal.reportedAverage !== null) && (
                <p className="mb-3 text-[13px] text-muted">
                  {appeal.reportedGrade && <>Grade <span className="num text-fg">{gradeLabel(appeal.reportedGrade)}</span></>}
                  {appeal.reportedAverage !== null && <> · Average <span className="num text-fg">{Number(appeal.reportedAverage)}</span></>}
                </p>
              )}
              <dl className="space-y-4">
                {appeal.answers.map((a) => (
                  <div key={a.id}>
                    <dt className="text-xs text-muted">{a.prompt}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm">{a.answer}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            {appeal.decisionNote && (
              <Section title="Decision">
                <p className="whitespace-pre-wrap text-sm">{appeal.decisionNote}</p>
              </Section>
            )}
            {status === "APPROVED" && <p className="text-[13px] text-green">Approved. The course now shows as approved via appeal in your plan.</p>}
            {isWithdrawable(status) && <WithdrawButton appealId={appeal.id} />}
          </>
        )}
      </div>
    </div>
  );
}
