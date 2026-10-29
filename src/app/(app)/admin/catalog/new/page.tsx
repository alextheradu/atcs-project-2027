export const instant = false;

import { PageHeader } from "@/components/ui/page";
import { CourseForm } from "@/components/catalog/course-form";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function NewCourse() {
  await requirePageRole("COUNSELOR", "ADMIN");
  const interests = await db.interestTag.findMany({ orderBy: { label: "asc" } });
  return (
    <div className="max-w-4xl">
      <PageHeader title="New course" back={{ href: "/admin/catalog", label: "Catalog" }} />
      <CourseForm
        mode="new"
        interestOptions={interests}
        initial={{
          slug: "", name: "", department: "OTHER", level: "CP", duration: "FULL", credits: 5, gradesOffered: [9, 10, 11, 12],
          description: "", prereqText: null, dualEnrollmentNote: null, hasApExam: false, plannable: true, sourcePage: null,
          dualEnrollment: false,
          requirements: [], interests: [],
        }}
      />
    </div>
  );
}
