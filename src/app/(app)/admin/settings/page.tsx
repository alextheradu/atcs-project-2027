// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { PageHeader, Section } from "@/components/ui/page";
import { AddDomainForm, DomainRow, SignupModeForm } from "@/components/admin/settings-forms";
import { requirePageRole } from "@/lib/auth/page";
import { getSignupMode } from "@/lib/auth/service";
import { db } from "@/lib/db";

export default async function AdminSettings() {
  await requirePageRole("ADMIN");
  const [mode, domains] = await Promise.all([getSignupMode(), db.allowedDomain.findMany({ orderBy: { domain: "asc" } })]);

  return (
    <div>
      <PageHeader title="Admin settings" description="Who can sign up, and which email domains map to which cohort." />
      <div className="space-y-10">
        <Section title="Signup mode">
          <SignupModeForm current={mode} />
        </Section>
        <Section title="Allowed domains" description="Add the four sending-district domains as INCOMING_8 once you have confirmed them.">
          <AddDomainForm />
          <ul className="list mt-6">
            {domains.map((d) => (
              <DomainRow key={d.id} id={d.id} domain={d.domain} cohort={d.cohort} enabled={d.enabled} />
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
