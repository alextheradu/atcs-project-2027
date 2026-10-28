import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Pascack Course Planner</h1>
      <p className="mt-2 text-muted">Unofficial student project. Sign-in arrives in Phase 1.</p>
      <Link href="/styleguide" className="btn btn-primary mt-6">Styleguide</Link>
    </main>
  );
}
