import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <p className="num text-muted">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">This page could not be found.</h1>
        <p className="mt-2 text-sm text-muted">It may have moved, or you may not have access to it.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
