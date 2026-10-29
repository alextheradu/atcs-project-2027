export const instant = false;

import Link from "next/link";
import { TONE } from "@/components/appeals/tone";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import { STATUS_LABEL, type AppealStatus } from "@/lib/appeals/rules";

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requirePageRole("SUPERVISOR", "ADMIN");
  const { show } = await searchParams;
  const done = show === "done";
  const appeals = await db.appeal.findMany({
    where: {
      status: done ? { in: ["APPROVED", "DENIED"] } : { in: ["SUBMITTED", "UNDER_REVIEW"] },
      // Supervisors only ever see their own departments. Admins see everything.
      ...(user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {}),
    },
    orderBy: done ? { decidedAt: "desc" } : { submittedAt: "asc" },
    take: 200,
    include: { targetCourse: { select: { name: true } } },
  });
  return (
    <div className="max-w-[900px]">
      <PageHeader
        title="Placement reviews"
        description={user.role === "SUPERVISOR" ? "Requests for courses in your departments." : "Requests for all departments."}
        actions={<Link className="btn btn-sm btn-ghost" href={done ? "/review" : "/review?show=done"}>{done ? "Show open" : "Show decided"}</Link>}
      />
      {appeals.length === 0 ? (
        <p className="text-sm text-muted">{done ? "No decisions yet." : "Nothing waiting."}</p>
      ) : (
        <ul className="list list-hover">
          {appeals.map((a) => (
            <li key={a.id}>
              <Link href={`/review/${a.id}`} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{a.targetCourse.name}</span>
                  <span className="num block text-xs text-muted">{DEPT_LABEL[a.department]}{a.submittedAt ? ` · sent ${a.submittedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</span>
                </span>
                <Badge tone={TONE[a.status as AppealStatus]}>{STATUS_LABEL[a.status as AppealStatus]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
