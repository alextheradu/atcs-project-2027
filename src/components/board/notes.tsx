import Link from "next/link";
import { db } from "@/lib/db";
import { markRead } from "@/lib/notify/actions";
import { countdownText, upcoming } from "@/lib/timeline";

const DAY = 86_400_000;
const APPEAL_STATE: Record<string, string> = { DRAFT: "is not sent yet", SUBMITTED: "was sent and is waiting", UNDER_REVIEW: "is being reviewed" };

function Note({ dot = "bg-accent", children, action }: { dot?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden className={`mt-[7px] size-2 shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0">{children}</span>
      </span>
      {action}
    </li>
  );
}

/** Unread notices, one line each, with a way to dismiss. Used on the Board and on Students. */
export async function UnreadNotes({ userId }: { userId: string }) {
  const items = await db.notification.findMany({ where: { userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 });
  return items.map((n) => (
    <Note
      key={n.id}
      action={
        <form action={markRead.bind(null, n.id)}>
          <button type="submit" className="shrink-0 text-[13px] font-medium text-muted hover:text-fg">Dismiss</button>
        </form>
      }
    >
      {n.url ? <Link href={n.url} className="font-medium text-accent-ink hover:underline">{n.title}</Link> : <span className="font-medium">{n.title}</span>}
      <span className="text-muted"> {n.body}</span>
    </Note>
  ));
}

/** A student's open placement reviews and the next date within 30 days. */
export async function StudentNotes({ userId, role }: { userId: string; role: string }) {
  const [appeals, events] = await Promise.all([
    db.appeal.findMany({
      where: { studentId: userId, status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, status: true, targetCourse: { select: { name: true } } },
    }),
    db.timelineEvent.findMany({ orderBy: { opensAt: "asc" } }),
  ]);
  const now = new Date();
  const soon = upcoming(events.map((e) => ({ ...e, audience: e.audience as "CURRENT" | "INCOMING" | "ALL" })), role, now, 1)
    .filter((u) => u.at.getTime() - now.getTime() <= 30 * DAY);
  return (
    <>
      {appeals.map((a) => (
        <Note key={a.id} dot={a.status === "DRAFT" ? "bg-dim" : "bg-accent"}>
          Your placement review for{" "}
          <Link href={`/appeals/${a.id}`} className="font-medium text-accent-ink hover:underline">{a.targetCourse.name}</Link>
          <span className="text-muted"> {APPEAL_STATE[a.status]}.</span>
        </Note>
      ))}
      {soon.map((u) => (
        <Note key={u.id} dot="bg-yellow">
          <span className="font-medium">{u.label}</span>
          <span className="text-muted">: {countdownText(u).toLowerCase()}.</span>
        </Note>
      ))}
    </>
  );
}
