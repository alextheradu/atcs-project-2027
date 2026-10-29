export const instant = false;

import { ImportFlow } from "@/components/import/import-flow";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { isEditable } from "@/lib/plans/schemas";

export default async function Import() {
  const user = await requirePageRole("STUDENT", "INCOMING");
  const [plans, courses, aliases] = await Promise.all([
    db.plan.findMany({ where: { ownerId: user.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true, name: true, isPrimary: true, status: true } }),
    db.course.findMany({ where: { plannable: true }, orderBy: { name: "asc" }, select: { id: true, name: true, archived: true } }),
    db.courseAlias.findMany({ select: { alias: true, courseId: true } }),
  ]);
  return (
    <div className="max-w-[860px]">
      <PageHeader title="Import courses" description="Bring in the courses you already took, then check each one before it is added." />
      <ImportFlow plans={plans.filter((p) => isEditable(p.status)).map(({ id, name, isPrimary }) => ({ id, name, isPrimary }))} courses={courses} aliases={aliases} />
    </div>
  );
}
