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
    <header className="mb-10">
      {back && (
        <Link href={back.href} className="mb-4 inline-block text-[13px] text-muted transition-colors hover:text-fg">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.035em]">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A titled block separated from the one above by a hairline. No box. */
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
    <section className={cn("border-t border-line pt-6", className)}>
      {title && (
        <div className="mb-4">
          <h2 className="text-sm font-medium">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-[13px] text-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label and value rows divided by hairlines. */
export function Dl({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="border-t border-line text-[13px]">
      {items.map((i) => (
        <div key={i.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
          <dt className="text-muted">{i.label}</dt>
          <dd className="text-right">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
