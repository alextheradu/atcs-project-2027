export const instant = false;

import { notFound } from "next/navigation";
import { RuleBuilder } from "@/components/rules/rule-builder";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import { parseRule } from "@/lib/eligibility";
import { canEditDepartment } from "@/lib/rules/scope";

export default async function RuleEditor({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("ADMIN", "SUPERVISOR");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();

  const course = await db.course.findUnique({ where: { id }, select: { id: true, slug: true, name: true, department: true, level: true, prereqText: true, sourcePage: true, rules: true } });
  // A supervisor does not learn that a course in another department exists.
  if (!course || !canEditDepartment(user, course.department)) notFound();

  const options = await db.course.findMany({
    where: { archived: false, slug: { not: course.slug } },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title={course.name}
        description={`${DEPT_LABEL[course.department]} · ${LEVEL_LABEL[course.level]}`}
        back={{ href: "/admin/rules", label: "Rules" }}
      />
      <div className="space-y-10">
        <Section title="Program of Studies text" description={course.sourcePage ? `Page ${course.sourcePage}. Encode only what this says. Anything else is a "checked by a person" step.` : undefined}>
          <p className="max-w-[65ch] text-sm leading-relaxed">{course.prereqText ?? "No prerequisite listed."}</p>
        </Section>
        <Section title="Rule">
          <RuleBuilder courseId={course.id} initial={parseRule(course.rules)} options={options} />
        </Section>
      </div>
    </div>
  );
}
