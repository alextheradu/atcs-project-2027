import Link from "next/link";

/** Very small markdown: `## ` headings and paragraphs. The policy text is ours, never user input. */
export function PolicyBody({ md }: { md: string }) {
  return (
    <div className="space-y-4">
      {md.split(/\n{2,}/).map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className="pt-4 text-base font-medium">{block.slice(3)}</h2>
        ) : (
          <p key={i} className="max-w-[65ch] text-sm leading-relaxed text-muted">{block}</p>
        ),
      )}
    </div>
  );
}

export function PolicyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[720px] px-6 py-14">
      <Link href="/" className="text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">Course Planner</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-muted">An unofficial student project. Not affiliated with Pascack Valley Regional High School District.</p>
      <div className="mt-8">{children}</div>
    </main>
  );
}
