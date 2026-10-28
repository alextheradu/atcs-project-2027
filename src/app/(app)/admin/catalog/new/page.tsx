export const instant = false;

import { CourseForm } from "@/components/catalog/course-form";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function NewCourse() {
  await requirePageRole("COUNSELOR", "ADMIN");
  const interests = await db.interestTag.findMany({ orderBy: { label: "asc" } });
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New course</h1>
      <CourseForm
        mode="new"
        interestOptions={interests}
        initial={{
          slug: "", name: "", department: "OTHER", level: "CP", duration: "FULL", credits: 5, gradesOffered: [9, 10, 11, 12],
          description: "", prereqText: null, dualEnrollmentNote: null, hasApExam: false, plannable: true, sourcePage: null,
          requirements: [], interests: [],
        }}
      />
    </div>
  );
}
