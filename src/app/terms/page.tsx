export const instant = false;

import { PolicyBody, PolicyShell } from "@/components/policy-page";
import { db } from "@/lib/db";

export const metadata = { title: "terms" };

export default async function Page() {
  const doc = await db.policyDocument.findFirst({ where: { kind: "TERMS" }, orderBy: { version: "desc" } });
  return (
    <PolicyShell title={doc?.title ?? "Not published yet"}>
      {doc ? <PolicyBody md={doc.bodyMd} /> : <p className="text-sm text-muted">This document has not been published yet.</p>}
    </PolicyShell>
  );
}
