import { db } from "@/lib/db";
import { notify } from "./index";

/** Days before a date that a reminder goes out. */
export const REMINDER_DAYS = [7, 1] as const;

/**
 * Removes the self-reported snapshot from incoming 8th graders once their first appeal cycle has ended.
 * The grades and the honesty record go. The 8th grade course and language stay because they are course
 * facts that place the math path, not grades a student estimated. The expiry date is cleared so it
 * runs once.
 */
export async function expireSnapshots(now = new Date()): Promise<number> {
  const r = await db.studentProfile.updateMany({
    where: { snapshotExpiresAt: { lte: now } },
    data: { eighthMathGrade: null, scienceGrade: null, englishGrade: null, historyGrade: null, honestyConfirmedAt: null, snapshotExpiresAt: null },
  });
  return r.count;
}

const audienceRoles = { CURRENT: ["STUDENT"], INCOMING: ["INCOMING"], ALL: ["STUDENT", "INCOMING"] } as const;
const DAY = 86_400_000;

/** One reminder per date and threshold, to the students it is for. Safe to run again the same day. */
export async function sendTimelineReminders(now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + 8 * DAY);
  const events = await db.timelineEvent.findMany({ where: { opensAt: { gt: now, lte: horizon } } });
  let sent = 0;
  for (const e of events) {
    const days = Math.ceil((e.opensAt.getTime() - now.getTime()) / DAY);
    const threshold = REMINDER_DAYS.find((d) => days <= d && (d === REMINDER_DAYS[REMINDER_DAYS.length - 1] || days > 1));
    if (!threshold) continue;
    const already = await db.notification.findFirst({ where: { kind: "TIMELINE_REMINDER", AND: [{ data: { path: ["eventId"], equals: e.id } }, { data: { path: ["days"], equals: threshold } }] }, select: { id: true } });
    if (already) continue;
    const users = await db.user.findMany({ where: { role: { in: [...audienceRoles[e.audience]] } }, select: { id: true }, take: 5000 });
    await db.$transaction(async (tx) => {
      await notify(tx, users.map((u) => ({
        userId: u.id, kind: "TIMELINE_REMINDER" as const, title: days <= 1 ? "Tomorrow" : `In ${days} days`,
        body: `${e.label} ${e.kind === "APPEAL_WINDOW" || e.kind === "COURSE_SELECTION" ? "opens" : "is due"} ${days <= 1 ? "tomorrow" : `in ${days} days`}.`,
        url: "/dashboard", data: { eventId: e.id, days: threshold },
      })));
    });
    sent += users.length;
  }
  return sent;
}

/** Hook for Phase 10: confirmed account deletions that are due. Nothing is scheduled before that phase. */
export async function processDueDeletions(): Promise<number> {
  return 0;
}
