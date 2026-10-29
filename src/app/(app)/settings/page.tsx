// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dl, PageHeader, Section } from "@/components/ui/page";
import { removeLinkedEmail, startLinkEmail } from "@/lib/account/actions";
import { requirePageUser } from "@/lib/auth/page";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { DataControls, type OpenDeletion } from "@/components/settings/data-controls";
import { db } from "@/lib/db";
import { KINDS, defaultPref, kindsFor, type Pref } from "@/lib/notify/policy";

const LINK_MESSAGES: Record<string, string> = {
  ok: "Email linked.",
  denied: "Start linking from this page first.",
  taken: "That email already belongs to another account.",
  unverified: "Google says that email is not verified.",
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const user = await requirePageUser();
  const { link } = await searchParams;
  const [linked, saved, devices, openRequest] = await Promise.all([
    db.linkedEmail.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.notificationPreference.findMany({ where: { userId: user.id } }),
    db.pushSubscription.count({ where: { userId: user.id } }),
    db.deletionRequest.findFirst({ where: { userId: user.id, status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } }, orderBy: { requestedAt: "desc" }, select: { status: true, source: true, scheduledFor: true } }),
  ]);
  const open: OpenDeletion | null = openRequest && {
    status: openRequest.status as OpenDeletion["status"],
    source: openRequest.source === "guardian" ? "guardian" : "self",
    scheduledOn: openRequest.scheduledFor?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? null,
  };
  const prefs = Object.fromEntries(KINDS.map((k) => [k, defaultPref(k)])) as Record<string, Pref>;
  for (const p of saved) prefs[p.kind] = { inApp: true, email: p.email, push: p.push };

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="space-y-10">
        <Section title="Account">
          <Dl items={[{ label: "Email", value: <span className="num">{user.email}</span> }, { label: "Role", value: <span className="num">{user.role.toLowerCase()}</span> }]} />
        </Section>

        <Section title="Notifications" description="Choose how you hear about reviews, plans and dates. In app messages are always on.">
          <NotificationSettings kinds={kindsFor(user.role)} initial={prefs} devices={devices} />
        </Section>

        <Section
          title="Linked emails"
          description="Link a second Google account, for example a personal one from 8th grade. Signing in with either opens the same plans."
        >
          {link && LINK_MESSAGES[link] && (
            <p role="status" className={link === "ok" ? "mb-4 text-[13px] text-green" : "mb-4 text-[13px] text-red"}>
              {LINK_MESSAGES[link]}
            </p>
          )}
          {linked.length > 0 && (
            <ul className="list mb-4">
              {linked.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="num">{l.email}</span>
                  <form action={removeLinkedEmail.bind(null, l.id)}>
                    <Button size="sm" variant="danger" type="submit">Unlink</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={startLinkEmail}>
            <Button type="submit">Link another email</Button>
          </form>
        </Section>

        <Section title="Your data" description={<>Download a copy or delete everything. The <Link href="/privacy" className="underline underline-offset-4 hover:text-fg">privacy policy</Link> says what is stored and why.</>}>
          <DataControls open={open} />
        </Section>
      </div>
    </div>
  );
}
