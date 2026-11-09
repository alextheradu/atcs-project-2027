/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links must work even when the client router fails. */
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page";

export interface RouteErrorProps {
  error: unknown;
  retry: () => void;
}

/** Shared by route fallbacks, including the standalone root-layout fallback. */
export function ErrorState({
  code,
  label,
  title,
  description,
  children,
}: {
  code: string;
  label: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="w-full max-w-[520px]">
      <p className="mb-4 text-[14px] text-muted">
        <span className="num">{code}</span>, {label.toLowerCase()}
      </p>
      <PageHeader title={title} description={description} />
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );
}

/** No session or database reads: recovery must work when those services fail. */
export function ErrorPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-6 sm:px-10">
      <header className="py-5">
        <a href="/" className="text-[16px] font-bold tracking-[-0.02em]">Course Planner</a>
      </header>
      <main id="content" className="flex flex-1 items-center py-16">{children}</main>
      <footer className="py-6 text-[13px] leading-relaxed text-muted">
        An unofficial student project. Not affiliated with Pascack Valley Regional High School District.
      </footer>
    </div>
  );
}

export function NotFoundState() {
  return (
    <ErrorState
      code="404"
      label="Page not found"
      title="This page is out of reach."
      description="The link may be outdated, or you may not have access to this page. Head back to your home page to keep planning."
    >
      <a href="/dashboard" className="btn btn-primary">Go to my home page</a>
      <a href="/" className="btn">Go home</a>
    </ErrorState>
  );
}
