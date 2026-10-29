import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DraftProvider } from "@/components/draft-state";
import { requirePageUser } from "@/lib/auth/page";
import { navFor } from "@/lib/nav";
import { needsOnboarding } from "@/lib/onboarding/gate";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (await needsOnboarding(user)) redirect("/onboarding");
  return (
    <AppShell nav={navFor(user.role).map(({ href, label, group }) => ({ href, label, group }))} user={{ name: user.name, email: user.email, role: user.role }}>
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
