import { cn } from "@/lib/utils";

/** An outlined empty place: one line on what goes here, one action. Same outline as an empty Board spot. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[14px] px-6 py-12 text-center shadow-[inset_0_0_0_1.5px_var(--line-strong)]", className)}>
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
