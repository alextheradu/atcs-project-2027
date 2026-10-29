// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { CancelDeletionButton, GuardianForm } from "@/components/admin/deletion-forms";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

const date = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "none");

export default async function Deletions() {
  await requirePageRole("ADMIN");
  const [pending, finished] = await Promise.all([
    db.deletionRequest.findMany({
      where: { status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } },
      orderBy: { requestedAt: "asc" },
      take: 200,
      select: { id: true, source: true, status: true, requestedAt: true, scheduledFor: true, user: { select: { name: true, email: true } } },
    }),
    db.deletionRequest.findMany({ where: { status: { in: ["COMPLETED", "CANCELLED"] } }, orderBy: { requestedAt: "desc" }, take: 30, select: { id: true, source: true, status: true, requestedAt: true, completedAt: true, cancelledAt: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Deletion requests" description="A request waits for the student to confirm by email, then runs 14 days later. Finished requests keep only a hash of the email." />
      <div className="space-y-10">
        <Section title="Open requests">
          {pending.length === 0 ? (
            <p className="text-[13px] text-muted">None.</p>
          ) : (
            <ul className="list">
              {pending.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="num text-[13px]">{r.user?.email ?? "account removed"}</span>{" "}
                    <span className="text-muted">{r.source === "guardian" ? "asked by a guardian" : "asked by the student"}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {r.status === "SCHEDULED" ? <Badge tone="warning">deletes <span className="num">{date(r.scheduledFor)}</span></Badge> : <Badge tone="review">waiting for confirmation</Badge>}
                    <CancelDeletionButton id={r.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Record a guardian request" description="A parent or guardian asked you to delete a student's data. Check who is asking first. The student is told, and the 14 days still apply. Only an admin can cancel it.">
          <GuardianForm />
        </Section>

        <Section title="Recently finished">
          {finished.length === 0 ? (
            <p className="text-[13px] text-muted">None yet.</p>
          ) : (
            <ul className="list">
              {finished.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-muted">{r.source === "guardian" ? "Guardian request" : "Student request"} from <span className="num">{date(r.requestedAt)}</span></span>
                  <span className="num">{r.status === "COMPLETED" ? `deleted ${date(r.completedAt)}` : `cancelled ${date(r.cancelledAt)}`}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
