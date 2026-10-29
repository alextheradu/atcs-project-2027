/** Upcoming dates for the dashboard, filtered by who is looking. Pure. */

export interface TimelineItem {
  id: string;
  kind: string;
  audience: "CURRENT" | "INCOMING" | "ALL";
  label: string;
  opensAt: Date;
  closesAt: Date | null;
}

export interface Upcoming {
  id: string;
  label: string;
  /** What the countdown is counting to. */
  phase: "opens" | "closes" | "due";
  at: Date;
  days: number;
}

const DAY = 86_400_000;
const audienceFor = (role: string): ("CURRENT" | "INCOMING" | "ALL")[] =>
  role === "INCOMING" ? ["INCOMING", "ALL"] : role === "STUDENT" ? ["CURRENT", "ALL"] : ["CURRENT", "INCOMING", "ALL"];

const daysUntil = (at: Date, now: Date) => Math.ceil((at.getTime() - now.getTime()) / DAY);

/** Dates still ahead, soonest first. A window in progress counts down to its close. */
export function upcoming(events: TimelineItem[], role: string, now = new Date(), limit = 5): Upcoming[] {
  const mine = events.filter((e) => audienceFor(role).includes(e.audience));
  const out: Upcoming[] = [];
  for (const e of mine) {
    if (e.opensAt.getTime() > now.getTime()) {
      out.push({ id: e.id, label: e.label, phase: e.closesAt ? "opens" : "due", at: e.opensAt, days: daysUntil(e.opensAt, now) });
    } else if (e.closesAt && e.closesAt.getTime() >= now.getTime()) {
      out.push({ id: e.id, label: e.label, phase: "closes", at: e.closesAt, days: daysUntil(e.closesAt, now) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}

export function countdownText(u: Pick<Upcoming, "phase" | "days">): string {
  const n = u.days <= 0 ? "today" : u.days === 1 ? "tomorrow" : `in ${u.days} days`;
  return u.phase === "opens" ? `Opens ${n}` : u.phase === "closes" ? `Closes ${n}` : `Due ${n}`;
}
