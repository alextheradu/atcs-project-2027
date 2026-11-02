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
  const total = EXAMPLE.reduce((n, col) => n + col.courses.reduce((m, [, c]) => m + Number(c), 0), 0);
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
        <span className="text-[14px] font-semibold">Course Planner</span>
        <span className="text-[13px] text-muted">Unofficial student project</span>
      </header>

      <div className="mx-auto grid max-w-[1100px] gap-16 px-6 pb-20 pt-12 lg:grid-cols-[360px_1fr] lg:gap-20 lg:pt-24">
        <section>
          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[48px]">
            Plan four years. Know what graduation needs.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            Build a course plan, track credits against the requirements, and see which classes you qualify for.
          </p>
          <Suspense>
            <RedirectIfSignedIn />
          </Suspense>
          <div className="mt-10 border-t border-line pt-6">
            <Suspense fallback={<div className="h-48" />}>
              <SignInCard />
            </Suspense>
          </div>
        </section>

        <section aria-label="Example plan">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="eyebrow">Example plan</h2>
            <span className="num text-muted">made up, not a real student</span>
          </div>
          <div className="grid gap-x-10 sm:grid-cols-2">
            {EXAMPLE.map((col) => {
              const sum = col.courses.reduce((n, [, c]) => n + Number(c), 0);
              return (
                <div key={col.grade} className="pt-6">
                  <div className="flex items-baseline justify-between pb-2">
                    <span className="eyebrow">Grade {col.grade}</span>
                    <span className="num text-muted">{sum} cr</span>
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
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="badge badge-warning">1 requirement left</span>
            <span className="text-[13px] text-muted">
              <span className="num text-fg">{total}</span> of <span className="num">120</span> credits. Needs 10 more Physical Education and Health.
            </span>
          </div>
        </section>
      </div>

      <footer className="mx-auto max-w-[1100px] px-6 pb-10">
        <p className="text-xs text-muted">
          Not affiliated with Pascack Valley Regional High School District. Plans are not official placements.
        </p>
      </footer>
    </main>
  );
}
