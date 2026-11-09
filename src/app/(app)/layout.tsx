import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftProvider } from "@/components/draft-state";
import { requirePageUser } from "@/lib/auth/page";
import { homeFor, menuFor, navFor } from "@/lib/nav";
import { db } from "@/lib/db";
import { needsOnboarding } from "@/lib/onboarding/gate";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (await needsOnboarding(user)) redirect("/onboarding");
  const nav = navFor(user.role);
  const has = (href: string) => nav.some((n) => n.href === href);
  const open = { in: ["SUBMITTED", "UNDER_REVIEW"] as ("SUBMITTED" | "UNDER_REVIEW")[] };
  const decides = user.role === "SUPERVISOR" || user.role === "ADMIN";
  const reviewsPlans = user.role === "COUNSELOR" || user.role === "ADMIN";
  // The Students count is the work waiting on this user. Each query is scoped the same way as the list it counts.
  const [toDecide, plansToReview] = has("/students")
    ? await Promise.all([
        decides ? db.appeal.count({ where: { status: open, ...(user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {}) } }) : 0,
        reviewsPlans ? db.plan.count({ where: { status: "SUBMITTED", isPrimary: true } }) : 0,
      ])
    : [0, 0];
  const counts: Record<string, number> = { "/students": toDecide + plansToReview };
  return (
    <AppShell
      nav={nav.map(({ href, label }) => ({ href, label, count: counts[href] || undefined }))}
      menu={menuFor(user.role).map(({ href, label }) => ({ href, label }))}
      home={homeFor(user.role)}
      user={{ name: user.name, email: user.email, role: user.role }}
    >
      <DraftProvider userId={user.id}>{children}</DraftProvider>
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
