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

const HOW_IT_WORKS = [
  {
    step: "1",
    headline: "Build your four-year plan.",
    body: "Pick courses for each grade. The board shows every subject you need to graduate and flags empty spots as you go.",
  },
  {
    step: "2",
    headline: "See exactly what is missing.",
    body: "Credits update live. Each subject row tells you how many more classes you still need, in plain words.",
  },
  {
    step: "3",
    headline: "Check if you can take a class.",
    body: "Every course shows its prerequisites and whether you meet them. If a placement does not look right, you can file an appeal.",
  },
];

export default function Home() {
  return (
    <main className="min-h-dvh">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>

      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 md:px-8">
        <span className="text-[16px] font-bold tracking-[-0.02em]">Course Planner</span>
        <a
          href="#sign-in"
          className="text-[14px] font-medium text-muted transition-colors hover:text-fg"
        >
          Sign in
        </a>
      </header>

      {/* Hero */}
      <div className="mx-auto grid max-w-[1180px] items-start gap-10 px-5 pb-16 pt-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:pt-16">
        {/* Left: headline + sign-in */}
        <section>
          <h1 className="max-w-[13ch] text-[40px] font-bold leading-[1.04] tracking-[-0.035em] md:text-[52px]">
            Your whole high school plan on one board.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-muted">
            See every subject, every year. Empty spots show what you still need to graduate, and
            each class tells you if you can take it.
          </p>

          <div id="sign-in" className="mt-10 scroll-mt-24">
            <Suspense fallback={<div className="h-52" />}>
              <SignInCard />
            </Suspense>
          </div>
        </section>

        {/* Right: board preview */}
        <div className="w-full">
          <MiniBoard />
        </div>
      </div>

      {/* How it works */}
      <section
        aria-label="How it works"
        className="mx-auto max-w-[1180px] px-5 pb-20 pt-4 md:px-8"
      >
        <h2 className="eyebrow mb-6 text-muted">How it works</h2>

        <ol className="grid gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="soft p-5">
              <span className="num mb-3 block text-[13px] font-bold text-muted">{item.step}</span>
              <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">
                {item.headline}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-[13px] text-muted">
          No AI, no guessing. Everything is based on the Program of Studies.
        </p>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 border-t border-[var(--line-strong)] px-5 py-8 md:px-8">
        <p className="text-[13px] text-muted">
          Unofficial. Not affiliated with the Pascack Valley Regional High School District. Plans
          are not official placements.
        </p>
        <nav aria-label="Legal" className="flex gap-4 text-[13px]">
          <Link href="/privacy" className="text-muted transition-colors hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted transition-colors hover:text-fg">
            Terms
          </Link>
        </nav>
      </footer>
    </main>
  );
}
