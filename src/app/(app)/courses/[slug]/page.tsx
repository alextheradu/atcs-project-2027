export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Dl, PageHeader, Section } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { DEPT_LABEL, KIND_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePageUser();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) notFound();
  const course = await db.course.findUnique({
    where: { slug },
    include: { requirements: true, interests: true },
  });
  if (!course || (course.archived && user.role !== "COUNSELOR" && user.role !== "ADMIN")) notFound();
  const canEdit = user.role === "COUNSELOR" || user.role === "ADMIN";

  return (
    <article>
      <PageHeader
        title={course.name}
        back={{ href: "/courses", label: "Courses" }}
        badge={course.archived ? <Badge tone="locked">Archived</Badge> : undefined}
        actions={canEdit ? <Link className="btn btn-sm" href={`/admin/catalog/${course.id}`}>Edit in catalog</Link> : undefined}
      />

      <div className="grid gap-12 md:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <p className="max-w-[65ch] leading-relaxed">{course.description}</p>

          {course.prereqText && (
            <Section title="Requirements from the Program of Studies" description="Automatic checking arrives in a later update. The school decides placement.">
              <p className="max-w-[65ch] text-sm leading-relaxed">{course.prereqText}</p>
            </Section>
          )}

          {course.dualEnrollmentNote && (
            <Section title="Dual enrollment">
              <p className="text-sm text-muted">{course.dualEnrollmentNote}</p>
            </Section>
          )}

          {course.requirements.length > 0 && (
            <Section title="Counts toward graduation">
              <ul className="list">
                {course.requirements.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>{KIND_LABEL[r.kind]}</span>
                    <span className="flex items-center gap-3">
                      {r.provisional && <Badge tone="warning">Needs counselor review</Badge>}
                      <span className="num">{fmtCredits(r.credits)} cr</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
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
