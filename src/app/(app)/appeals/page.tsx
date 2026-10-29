export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { STUDENT_WORKSPACE_ROLES } from "@/lib/auth/student-access";
import { db } from "@/lib/db";
import { STATUS_LABEL, type AppealStatus } from "@/lib/appeals/rules";
import { TONE } from "@/components/appeals/tone";

export default async function Appeals() {
  const user = await requirePageRole(...STUDENT_WORKSPACE_ROLES);
  const appeals = await db.appeal.findMany({
    where: { studentId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { targetCourse: { select: { name: true } } },
  });
  return (
    <div className="max-w-[860px]">
      <PageHeader title="Placement reviews" description="Ask a department supervisor to place you in a course you do not automatically qualify for. The supervisor decides." />
      {appeals.length === 0 ? (
        <EmptyState title="No requests yet" description="Open a course you want and choose Request placement review. Courses you may ask about are marked on the pathways page." action={<Link className="btn btn-sm" href="/pathways">See pathways</Link>} />
      ) : (
        <ul className="list list-hover">
          {appeals.map((a) => (
            <li key={a.id}>
              <Link href={`/appeals/${a.id}`} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[13px] font-medium">{a.targetCourse.name}</span>
                <Badge tone={TONE[a.status as AppealStatus]}>{STATUS_LABEL[a.status as AppealStatus]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
