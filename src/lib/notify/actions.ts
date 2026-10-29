"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAllowedPushEndpoint } from "./endpoint";
import { KINDS, isEmailLocked } from "./policy";

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const id = z.string().regex(/^[a-z0-9]{1,64}$/i);

/** Marks one of the signed in user's notifications read. Ownership is part of the query. */
export async function markRead(notificationId: unknown): Promise<void> {
  const user = await requireUser();
  const nid = id.safeParse(notificationId);
  if (!nid.success) return;
  await db.notification.updateMany({ where: { id: nid.data, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

const prefsSchema = z.array(z.object({ kind: z.enum(KINDS), inApp: z.boolean(), email: z.boolean(), push: z.boolean() })).max(KINDS.length);

export async function savePreferences(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = prefsSchema.safeParse(input);
  if (!p.success) return fail("Check your choices and try again.");
  await db.$transaction(
    p.data.map((x) => {
      // In app stays on, and account safety emails cannot be switched off.
      const data = { inApp: true, email: x.email || isEmailLocked(x.kind), push: x.push };
      return db.notificationPreference.upsert({ where: { userId_kind: { userId: user.id, kind: x.kind } }, create: { userId: user.id, kind: x.kind, ...data }, update: data });
    }),
  );
  revalidatePath("/settings");
  return { ok: true };
}

const MAX_DEVICES = 10;
const subSchema = z.object({
  endpoint: z.string().url().max(600).refine(isAllowedPushEndpoint, "That is not a browser push service."),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(10).max(100),
  userAgent: z.string().max(200).optional(),
});

/** Stores this browser's push subscription for the signed in user. */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = subSchema.safeParse(input);
  if (!p.success) return fail("That device could not be subscribed.");
  const have = await db.pushSubscription.count({ where: { userId: user.id } });
  const existing = await db.pushSubscription.findUnique({ where: { endpoint: p.data.endpoint }, select: { id: true } });
  if (!existing && have >= MAX_DEVICES) return fail(`You can use push on up to ${MAX_DEVICES} devices. Remove one first.`);
  await db.pushSubscription.upsert({
    where: { endpoint: p.data.endpoint },
    create: { userId: user.id, ...p.data },
    update: { userId: user.id, p256dh: p.data.p256dh, auth: p.data.auth, userAgent: p.data.userAgent, lastSeenAt: new Date() },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removePushSubscription(endpoint: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const e = z.string().url().max(600).safeParse(endpoint);
  if (!e.success) return fail("That device was not found.");
  await db.pushSubscription.deleteMany({ where: { endpoint: e.data, userId: user.id } });
  revalidatePath("/settings");
  return { ok: true };
}
