import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  badge,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  badge?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-block text-[14px] text-muted transition-colors hover:text-fg">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1.5 max-w-xl text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A titled block. Space separates it from the one above; there is no line or box.
 * `split` puts the title and description in a left column and the content beside it on wide
 * screens, so settings and reading pages use the full width instead of hugging the left edge.
 */
export function Section({
  title,
  description,
  children,
  className,
  split,
  id,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  split?: boolean;
  id?: string;
}) {
  if (split) {
    return (
      <section id={id} className={cn("grid gap-x-12 gap-y-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]", className)}>
        <div className="lg:pt-0.5">
          {title && <h2 className="eyebrow">{title}</h2>}
          {description && <p className="mt-1 max-w-[36ch] text-[14px] leading-relaxed text-muted">{description}</p>}
        </div>
        <div className="min-w-0">{children}</div>
      </section>
    );
  }
  return (
    <section id={id} className={cn("pt-2", className)}>
      {title && (
        <div className="mb-3">
          <h2 className="eyebrow">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-[14px] text-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A group of `Row`s in one soft block. Space separates the rows, never a line. */
export function Rows({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("soft flex flex-col py-1.5", className)}>{children}</div>;
}

/** One setting or action: what it is on the left, its control on the right. Stacks on phones. */
export function Row({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        {description && <div className="mt-0.5 max-w-[60ch] text-[13px] leading-relaxed text-muted">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Facts about one thing: label on the left, value on the right, rows separated by space. */
export function Dl({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="soft px-4 py-2 text-[14px]">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">{i.label}</dt>
          <dd className="text-right">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
