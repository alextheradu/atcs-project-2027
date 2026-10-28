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
    <main className="mx-auto flex min-h-screen max-w-[1200px] flex-col justify-center gap-10 px-6 py-16 md:flex-row md:items-center md:justify-between">
      <section className="max-w-lg">
        <h1 className="text-4xl font-semibold tracking-tight">Pascack Course Planner</h1>
        <p className="mt-3 text-muted">
          Plan four years of classes, see what graduation still needs, and check which courses you qualify for.
        </p>
        <p className="mt-6 text-xs text-muted">
          Unofficial student project. Not affiliated with Pascack Valley Regional High School District. Plans are
          not official placements.
        </p>
      </section>
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Suspense fallback={<div className="auth-texture h-64 w-full max-w-sm rounded-xl border border-line" />}>
        <SignInCard />
      </Suspense>
    </main>
  );
}
