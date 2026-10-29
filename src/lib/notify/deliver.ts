import { Resend } from "resend";
import webpush from "web-push";
import { db } from "@/lib/db";
import { emailOutcome, pushOutcome, type EmailResult, type Outcome, type PushResult } from "./outcome";
import { isAllowedPushEndpoint } from "./endpoint";
import { pushPayload, redactEmail } from "./policy";

const BATCH = 50;
/** A claimed delivery that is not finished within this long becomes available again. */
const LEASE_MINUTES = 5;

/**
 * Claims due deliveries so two overlapping workers never take the same row. FOR UPDATE SKIP LOCKED
 * hides rows another transaction holds, and the lease moves the next attempt time forward, so a
 * crashed worker's rows come back after a few minutes.
 */
export async function claimDue(limit = BATCH): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "NotificationDelivery"
    SET "nextAttemptAt" = now() + (${LEASE_MINUTES} * interval '1 minute')
    WHERE id IN (
      SELECT id FROM "NotificationDelivery"
      WHERE status = 'PENDING' AND channel IN ('EMAIL', 'PUSH') AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((r) => r.id);
}

const appUrl = () => (process.env.APP_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "");

async function sendEmail(to: string, n: { title: string; body: string; url: string | null }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, permanent: true, error: "email is not configured" };
  const link = n.url && appUrl() ? `\n\nOpen it: ${appUrl()}${n.url}` : "";
  try {
    const r = await new Resend(key).emails.send({
      from, to, subject: n.title,
      text: `${n.body}${link}\n\nThis is an unofficial student planning tool. Change which emails you get in Settings.`,
    });
    if (r.error) return { ok: false, permanent: r.error.name === "validation_error", error: r.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

let vapidReady = false;
function vapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || pub === priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  return (vapidReady = true);
}

async function sendPush(subs: { endpoint: string; p256dh: string; auth: string }[], n: { title: string; body: string; url: string | null }): Promise<PushResult[]> {
  if (!vapid()) return subs.map((s) => ({ endpoint: s.endpoint, ok: false, error: "push is not configured" }));
  const payload = pushPayload(n);
  return Promise.all(
    subs.map(async (s): Promise<PushResult> => {
      // A saved endpoint outside the push services is never called. It is treated as gone and removed.
      if (!isAllowedPushEndpoint(s.endpoint)) return { endpoint: s.endpoint, ok: false, gone: true, error: "endpoint not allowed" };
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 });
        return { endpoint: s.endpoint, ok: true };
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        return { endpoint: s.endpoint, ok: false, gone: code === 404 || code === 410, error: `push failed${code ? ` (${code})` : ""}` };
      }
    }),
  );
}

/** Sends one claimed delivery and records what happened. Returns the outcome, never throws on a send failure. */
export async function processDelivery(id: string, now = new Date()): Promise<Outcome | null> {
  const d = await db.notificationDelivery.findUnique({
    where: { id },
    include: { notification: { include: { user: { select: { email: true, pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } } } } } } },
  });
  if (!d || d.status !== "PENDING") return null;
  const attempts = d.attempts + 1;
  const n = d.notification;

  let outcome: Outcome;
  if (d.channel === "EMAIL") {
    outcome = emailOutcome(attempts, await sendEmail(n.user.email, n), now);
    // Logs never carry a full address.
    if (outcome.status !== "SENT") console.warn(`email delivery ${id} to ${redactEmail(n.user.email)}: ${outcome.status}`);
  } else {
    outcome = pushOutcome(attempts, await sendPush(n.user.pushSubscriptions, n), now);
    if (outcome.status !== "SENT") console.warn(`push delivery ${id}: ${outcome.status}`);
  }

  await db.$transaction(async (tx) => {
    await tx.notificationDelivery.update({
      where: { id },
      data: { status: outcome.status, attempts, lastError: outcome.lastError, sentAt: outcome.status === "SENT" ? now : null, ...(outcome.nextAttemptAt ? { nextAttemptAt: outcome.nextAttemptAt } : {}) },
    });
    if (outcome.deleteEndpoints.length) await tx.pushSubscription.deleteMany({ where: { endpoint: { in: outcome.deleteEndpoints } } });
  });
  return outcome;
}
