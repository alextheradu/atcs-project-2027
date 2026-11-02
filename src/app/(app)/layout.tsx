import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftProvider } from "@/components/draft-state";
import { requirePageUser } from "@/lib/auth/page";
import { navFor } from "@/lib/nav";
import { db } from "@/lib/db";
import { needsOnboarding } from "@/lib/onboarding/gate";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (await needsOnboarding(user)) redirect("/onboarding");
  const nav = navFor(user.role);
  const has = (href: string) => nav.some((n) => n.href === href);
  const open = { in: ["SUBMITTED", "UNDER_REVIEW"] as ("SUBMITTED" | "UNDER_REVIEW")[] };
  // Counts mark work waiting on this user. Each query is scoped the same way as the page it counts for.
  const [unread, myAppeals, toReview, plansToReview] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    has("/appeals") ? db.appeal.count({ where: { studentId: user.id, status: open } }) : 0,
    has("/review")
      ? db.appeal.count({ where: { status: open, ...(user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {}) } })
      : 0,
    has("/counselor") ? db.plan.count({ where: { status: "SUBMITTED" } }) : 0,
  ]);
  const counts: Record<string, number> = { "/appeals": myAppeals, "/review": toReview, "/counselor": plansToReview };
  return (
    <AppShell nav={nav.map(({ href, label, group }) => ({ href, label, group, count: counts[href] || undefined }))} user={{ name: user.name, email: user.email, role: user.role }} unread={unread}>
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
