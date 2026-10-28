export const instant = false;

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AliasManager } from "@/components/catalog/alias-manager";
import { CourseForm } from "@/components/catalog/course-form";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("COUNSELOR", "ADMIN");
  const { id } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(id)) notFound();
  const [course, interests] = await Promise.all([
    db.course.findUnique({ where: { id }, include: { requirements: true, interests: true, aliases: { orderBy: { alias: "asc" } } } }),
    db.interestTag.findMany({ orderBy: { label: "asc" } }),
  ]);
  if (!course) notFound();

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <Link href="/admin/catalog" className="text-sm text-muted hover:text-fg">Back to catalog</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
          {course.archived && <Badge tone="locked">Archived</Badge>}
          <Link className="btn btn-sm btn-ghost" href={`/courses/${course.slug}`}>View as student</Link>
        </div>
      </header>

      <CourseForm
        mode="edit"
        courseId={course.id}
        archived={course.archived}
        interestOptions={interests}
        initial={{
          slug: course.slug, name: course.name, department: course.department, level: course.level,
          duration: course.duration, credits: Number(course.credits), gradesOffered: course.gradesOffered,
          description: course.description, prereqText: course.prereqText, dualEnrollmentNote: course.dualEnrollmentNote,
          hasApExam: course.hasApExam, plannable: course.plannable, sourcePage: course.sourcePage,
          requirements: course.requirements.map((r) => ({ kind: r.kind, credits: Number(r.credits), provisional: r.provisional })),
          interests: course.interests.map((i) => i.slug),
        }}
      />

      <AliasManager courseId={course.id} aliases={course.aliases.map((a) => ({ id: a.id, alias: a.alias }))} />
    </div>
  );
}
