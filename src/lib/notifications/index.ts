import type { db } from "@/lib/db";

type Tx = Pick<typeof db, "notification">;

export interface NotifyInput {
  userId: string;
  kind: "APPEAL_SUBMITTED" | "APPEAL_ASSIGNED" | "APPEAL_DECIDED" | "SYSTEM";
  title: string;
  body: string;
  url?: string;
}

/** Records an in-app notification. Email and push delivery come in Phase 9. Keep bodies free of grades and answers. */
export async function notify(tx: Tx, items: NotifyInput[]) {
  if (items.length === 0) return;
  await tx.notification.createMany({
    data: items.map((n) => ({ userId: n.userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body.slice(0, 300), url: n.url ?? null })),
  });
}
