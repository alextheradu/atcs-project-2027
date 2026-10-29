export const instant = false;

import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { markAllRead, markRead } from "@/lib/notify/actions";

export default async function Notifications() {
  const user = await requirePageUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="max-w-[760px]">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You are all caught up."}
        actions={unread ? <form action={markAllRead}><button className="btn btn-sm" type="submit">Mark all read</button></form> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" description="Updates about your plans, reviews and dates will show up here." />
      ) : (
        <ul className="list">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  {!n.readAt && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />}
                  {!n.readAt && <span className="sr-only">Unread: </span>}
                  {n.url ? <Link href={n.url} className="underline-offset-4 hover:underline">{n.title}</Link> : n.title}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{n.body}</span>
                <span className="num mt-0.5 block text-xs text-muted">{n.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </span>
              {!n.readAt && <form action={markRead.bind(null, n.id)}><button className="btn btn-sm btn-ghost" type="submit">Mark read</button></form>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
