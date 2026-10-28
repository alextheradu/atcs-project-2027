export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
    <article className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link href="/courses" className="text-sm text-muted hover:text-fg">Back to courses</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
          {course.archived && <Badge tone="locked">Archived</Badge>}
        </div>
        <p className="text-sm text-muted">
          {DEPT_LABEL[course.department]} · {LEVEL_LABEL[course.level]} · {course.duration === "HALF" ? "Half year" : "Full year"}
        </p>
        <div className="flex flex-wrap gap-6 font-mono text-sm">
          <span>{fmtCredits(course.credits)} credits</span>
          <span>Grade {course.gradesOffered.join(", ")}</span>
          {course.sourcePage && <span className="text-muted">PDF p.{course.sourcePage}</span>}
        </div>
      </header>

      <p className="leading-relaxed">{course.description}</p>

      {course.prereqText && (
        <section className="card p-4">
          <h2 className="text-sm font-medium">Requirements from the Program of Studies</h2>
          <p className="mt-2 text-sm leading-relaxed">{course.prereqText}</p>
          <p className="mt-2 text-xs text-muted">Automatic checking arrives in a later update. The school decides placement.</p>
        </section>
      )}

      {course.dualEnrollmentNote && (
        <section className="card p-4 text-sm">
          <h2 className="font-medium">Dual enrollment</h2>
          <p className="mt-1 text-muted">{course.dualEnrollmentNote}</p>
        </section>
      )}

      {course.requirements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Counts toward graduation</h2>
          <ul className="flex flex-wrap gap-2">
            {course.requirements.map((r) => (
              <li key={r.id}>
                <Badge tone={r.provisional ? "warning" : "eligible"}>
                  {KIND_LABEL[r.kind]} <span className="font-mono">{fmtCredits(r.credits)}</span>
                  {r.provisional ? " · needs counselor review" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {course.interests.length > 0 && (
        <p className="text-sm text-muted">Related interests: {course.interests.map((i) => i.label).join(", ")}</p>
      )}

      {canEdit && <Link className="btn btn-sm" href={`/admin/catalog/${course.id}`}>Edit in catalog admin</Link>}
    </article>
  );
}
