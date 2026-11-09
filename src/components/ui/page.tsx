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

/** A titled block. Space separates it from the one above; there is no line or box. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pt-2", className)}>
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
