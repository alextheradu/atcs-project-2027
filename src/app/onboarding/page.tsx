export const instant = false;

import { redirect } from "next/navigation";
import { Wizard } from "@/components/onboarding/wizard";
import { DraftProvider } from "@/components/draft-state";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { needsOnboarding, latestPolicies } from "@/lib/onboarding/gate";

const SUMMARY: Record<string, string> = {
  PRIVACY: "What we collect (name, email, grade, your plan), who sees it, and how to delete it. We never store your age.",
  TERMS: "This is an unofficial tool. It does not place you in courses and suggestions can be wrong.",
};

export default async function Onboarding() {
  const user = await requirePageUser();
  if (user.role !== "STUDENT" && user.role !== "INCOMING") redirect("/dashboard");
  if (!(await needsOnboarding(user))) redirect("/dashboard");

  const [progress, profile, policies, interests, row] = await Promise.all([
    db.onboardingProgress.findUnique({ where: { userId: user.id } }),
    db.studentProfile.findUnique({ where: { userId: user.id }, select: { cohort: true } }),
    latestPolicies(),
    db.interestTag.findMany({ orderBy: { label: "asc" }, select: { slug: true, label: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { onboardedAt: true } }),
  ]);

  // A new policy version re-prompts onboarded users at the policy step only.
  const startStep = row?.onboardedAt ? 1 : (progress?.step ?? 0);
  return (
    <main className="min-h-dvh px-4 py-14">
      <DraftProvider userId={user.id}><Wizard
        startStep={profile ? Math.max(startStep, 0) : 0}
        cohort={profile?.cohort ?? null}
        needsAgeBox
        interests={interests}
        policies={policies.map((p) => ({ id: p.id, kind: p.kind, title: p.title, summary: SUMMARY[p.kind] ?? "", href: p.kind === "PRIVACY" ? "/privacy" : "/terms" }))}
      /></DraftProvider>
    </main>
  );
}
