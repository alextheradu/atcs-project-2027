import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth/page";
import { navFor } from "@/lib/nav";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return (
    <AppShell nav={navFor(user.role)} user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
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
