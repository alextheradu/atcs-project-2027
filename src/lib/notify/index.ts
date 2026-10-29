import type { db } from "@/lib/db";
import { channelsFor, type Kind, type Pref } from "./policy";

type Tx = Pick<typeof db, "notification" | "notificationPreference" | "notificationDelivery">;

export interface NotifyInput {
  userId: string;
  kind: Kind;
  title: string;
  body: string;
  url?: string;
  /** Small structured detail, for example which date a reminder was for. Never grades or answers. */
  data?: Record<string, string | number>;
}

/**
 * Records in-app notifications and queues email and push deliveries for the channels each user wants.
 * Call it inside the transaction that made the change, so a notification exists only if the change did.
 * Bodies must not carry grades, answers or comment text.
 */
export async function notify(tx: Tx, items: NotifyInput[]) {
  if (items.length === 0) return;
  const prefs = await tx.notificationPreference.findMany({
    where: { userId: { in: [...new Set(items.map((i) => i.userId))] }, kind: { in: [...new Set(items.map((i) => i.kind))] } },
  });
  const saved = new Map(prefs.map((p) => [`${p.userId}:${p.kind}`, { inApp: p.inApp, email: p.email, push: p.push } satisfies Pref]));

  const created = await tx.notification.createManyAndReturn({
    data: items.map((n) => ({ userId: n.userId, kind: n.kind, title: n.title.slice(0, 120), body: n.body.slice(0, 300), url: n.url ?? null, data: n.data ?? undefined })),
    select: { id: true, userId: true, kind: true },
  });

  const deliveries = created.flatMap((n) => channelsFor(n.kind as Kind, saved.get(`${n.userId}:${n.kind}`)).map((channel) => ({ notificationId: n.id, channel })));
  if (deliveries.length) await tx.notificationDelivery.createMany({ data: deliveries });
}
