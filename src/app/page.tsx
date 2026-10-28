import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { getCurrentUser } from "@/lib/auth";

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/dashboard");
  return null;
}

// A made-up plan, only here to show what the planner looks like.
const EXAMPLE: { grade: number; courses: [string, string][] }[] = [
  { grade: 9, courses: [["English I", "5"], ["Geometry", "5"], ["Biology", "5"], ["World History", "5"], ["Spanish I", "5"], ["Physical Education/Health 9", "5"]] },
  { grade: 10, courses: [["Honors English II", "5"], ["Algebra II", "5"], ["Chemistry", "5"], ["U.S. History I", "5"], ["Spanish II", "5"], ["Financial Literacy", "2.5"]] },
  { grade: 11, courses: [["English III", "5"], ["Pre-Calculus", "5"], ["Physics", "5"], ["U.S. History II", "5"], ["Studio Art I", "5"], ["Spanish III", "5"]] },
  { grade: 12, courses: [["English IV", "5"], ["AP Statistics", "5"], ["AP Computer Science A", "5"], ["Psychology", "5"], ["Culinary Arts I", "5"], ["Physical Education/Health 12", "5"]] },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="grid-backdrop pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_55%_70%_at_50%_0%,rgb(255_255_255/0.07),transparent_70%)]"
      />

      <header className="fixed inset-x-0 top-5 z-40 flex justify-center px-4">
        <div className="flex items-center gap-3 rounded-full border border-line bg-raised py-1.5 pl-2 pr-4 text-[13px]">
          <span aria-hidden className="grid size-6 place-items-center rounded-full bg-fg font-mono text-[11px] font-bold text-bg">
            C
          </span>
          <span className="font-medium tracking-tight">Course Planner</span>
          <span aria-hidden className="h-3.5 w-px bg-white/15" />
          <span className="text-muted">Unofficial student project</span>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1100px] px-6">
        <div className="flex min-h-dvh flex-col justify-center gap-14 pb-16 pt-32 md:flex-row md:items-center md:justify-between">
          <section className="max-w-xl">
            <h1 className="text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[64px]">
              <span className="hero-in block" style={{ ["--d" as string]: "0ms" }}>
                Plan four years.
              </span>
              <span className="hero-in block text-muted" style={{ ["--d" as string]: "90ms" }}>
                Know what graduation needs.
              </span>
            </h1>
            <p className="hero-in mt-7 max-w-md text-[15px] leading-relaxed text-muted" style={{ ["--d" as string]: "220ms" }}>
              Build a course plan, track credits against the requirements, and see which classes you qualify for.
            </p>
          </section>
          <Suspense>
            <RedirectIfSignedIn />
          </Suspense>
          <div className="hero-in w-full max-w-[320px]" style={{ ["--d" as string]: "340ms" }}>
            <Suspense fallback={<div className="h-48" />}>
              <SignInCard />
            </Suspense>
          </div>
        </div>

        <section aria-label="Example plan" className="hero-in pb-24" style={{ ["--d" as string]: "480ms" }}>
          <div className="mb-4 flex items-baseline justify-between border-t border-line pt-4">
            <h2 className="text-sm font-medium">What a plan looks like</h2>
            <span className="num text-muted">example, not a real student</span>
          </div>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {EXAMPLE.map((col) => {
              const total = col.courses.reduce((n, [, c]) => n + Number(c), 0);
              return (
                <div key={col.grade}>
                  <div className="flex items-baseline justify-between pb-2">
                    <span className="text-[13px] font-medium">Grade {col.grade}</span>
                    <span className="num text-muted">{total} cr</span>
                  </div>
                  <ul className="list text-[13px]">
                    {col.courses.map(([name, cr]) => (
                      <li key={name} className="flex items-baseline justify-between gap-3 py-2">
                        <span className="truncate">{name}</span>
                        <span className="num text-muted">{cr}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-xs text-muted">
            Not affiliated with Pascack Valley Regional High School District. Plans are not official placements.
          </p>
        </section>
      </div>
    </main>
  );
}
