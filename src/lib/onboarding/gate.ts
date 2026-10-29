import { db } from "@/lib/db";

/** The newest version of each policy document. */
export async function latestPolicies() {
  const docs = await db.policyDocument.findMany({ orderBy: { version: "desc" } });
  return [...new Map(docs.map((d) => [d.kind, d])).values()];
}

/** Students and incoming 8th graders must finish onboarding and accept the current policies. Staff skip it. */
export async function needsOnboarding(user: { id: string; role: string }): Promise<boolean> {
  if (user.role !== "STUDENT" && user.role !== "INCOMING") return false;
  const row = await db.user.findUnique({ where: { id: user.id }, select: { onboardedAt: true } });
  if (!row?.onboardedAt) return true;
  const latest = await latestPolicies();
  if (latest.length === 0) return false;
  const accepted = await db.policyAcceptance.count({ where: { userId: user.id, documentId: { in: latest.map((d) => d.id) } } });
  return accepted < latest.length;
}
