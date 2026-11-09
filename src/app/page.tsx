import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniBoard } from "@/components/landing/mini-board";
import { SignInCard } from "@/components/sign-in-card";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/nav";

async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return null;
}

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-8">
        <span className="text-[16px] font-bold tracking-[-0.02em]">Course Planner</span>
        <a href="#sign-in" className="text-[14px] font-medium text-muted transition-colors hover:text-fg">Sign in</a>
      </header>

      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-4 pb-16 pt-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-20">
        <section>
          <h1 className="max-w-[14ch] text-[40px] font-bold leading-[1.04] tracking-[-0.035em] md:text-[52px]">
            Your whole high school plan on one board.
          </h1>
          <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-muted">
            Every subject, every year. Empty spots show what you still need to graduate, and each class tells you if you can take it.
          </p>
          <Suspense>
            <RedirectIfSignedIn />
          </Suspense>
          <div id="sign-in" className="mt-8 scroll-mt-20">
            <Suspense fallback={<div className="h-48" />}>
              <SignInCard />
            </Suspense>
          </div>
        </section>

        <MiniBoard />
      </div>

      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 pb-10 md:px-8">
        <p className="text-[13px] text-muted">Unofficial. Not affiliated with the Pascack Valley Regional High School District. Plans are not official placements.</p>
        <nav aria-label="Legal" className="flex gap-4 text-[13px]">
          <Link href="/privacy" className="text-muted hover:text-fg">Privacy</Link>
          <Link href="/terms" className="text-muted hover:text-fg">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
