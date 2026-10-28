// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { AddDomainForm, DomainRow, SignupModeForm } from "@/components/admin/settings-forms";
import { requirePageRole } from "@/lib/auth/page";
import { getSignupMode } from "@/lib/auth/service";
import { db } from "@/lib/db";

export default async function AdminSettings() {
  await requirePageRole("ADMIN");
  const [mode, domains] = await Promise.all([getSignupMode(), db.allowedDomain.findMany({ orderBy: { domain: "asc" } })]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin settings</h1>
        <p className="mt-1 text-muted">Who can sign up, and which email domains map to which cohort.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Signup mode</h2>
        <SignupModeForm current={mode} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Allowed domains</h2>
        <AddDomainForm />
        <ul className="card divide-y divide-line">
          {domains.map((d) => (
            <DomainRow key={d.id} id={d.id} domain={d.domain} cohort={d.cohort} enabled={d.enabled} />
          ))}
        </ul>
        <p className="text-xs text-muted">
          Add the four sending-district domains here as INCOMING_8 once you have confirmed them.
        </p>
      </section>
    </div>
  );
}
