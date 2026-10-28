// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { Button } from "@/components/ui/button";
import { Dl, PageHeader, Section } from "@/components/ui/page";
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
    <div>
      <PageHeader title="Settings" />

      <div className="space-y-10">
        <Section title="Account">
          <Dl items={[{ label: "Email", value: <span className="num">{user.email}</span> }, { label: "Role", value: <span className="num">{user.role.toLowerCase()}</span> }]} />
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
      </div>
    </div>
  );
}
