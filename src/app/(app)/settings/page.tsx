// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { Button } from "@/components/ui/button";
import { removeLinkedEmail, startLinkEmail } from "@/lib/account/actions";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";

const LINK_MESSAGES: Record<string, string> = {
  ok: "Email linked.",
  denied: "Start linking from this page first.",
  taken: "That email already belongs to another account.",
  unverified: "Google says that email is not verified.",
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const user = await requirePageUser();
  const { link } = await searchParams;
  const linked = await db.linkedEmail.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Account</h2>
        <div className="card p-4 text-sm">
          <div className="font-mono">{user.email}</div>
          <div className="text-muted">{user.role}</div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Linked emails</h2>
        <p className="text-sm text-muted">
          Link a second Google account, for example a personal one from 8th grade. Signing in with either opens the
          same plans.
        </p>
        {link && LINK_MESSAGES[link] && (
          <p role="status" className={link === "ok" ? "text-sm text-green" : "text-sm text-red"}>
            {LINK_MESSAGES[link]}
          </p>
        )}
        {linked.length > 0 && (
          <ul className="card divide-y divide-line">
            {linked.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-mono">{l.email}</span>
                <form action={removeLinkedEmail.bind(null, l.id)}>
                  <Button size="sm" variant="danger" type="submit">
                    Unlink
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={startLinkEmail}>
          <Button type="submit">Link another email</Button>
        </form>
      </section>
    </div>
  );
}
