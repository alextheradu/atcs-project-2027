import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { getCurrentUser } from "@/lib/auth";

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-dvh max-w-[1100px] flex-col px-6">
        <header className="flex h-16 items-center gap-2 text-[13px] font-semibold tracking-tight">
          <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-fg font-mono text-[10px] font-bold text-bg">
            C
          </span>
          Course Planner
        </header>

        <div className="page-enter flex flex-1 flex-col justify-center gap-14 pb-20 md:flex-row md:items-center md:justify-between">
          <section className="max-w-xl">
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.045em] md:text-[56px]">
              Plan four years.
              <br />
              <span className="text-muted">Know what graduation needs.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              Build a course plan, track credits against the requirements, and see which classes you qualify for.
            </p>
          </section>
          <Suspense>
            <RedirectIfSignedIn />
          </Suspense>
          <Suspense fallback={<div className="h-48 w-full max-w-[320px]" />}>
            <SignInCard />
          </Suspense>
        </div>

        <footer className="pb-6 text-xs text-muted">
          Unofficial student project. Not affiliated with Pascack Valley Regional High School District. Plans are not
          official placements.
        </footer>
      </div>
    </main>
  );
}
