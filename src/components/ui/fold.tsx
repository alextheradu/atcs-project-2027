import { ChevronDown } from "lucide-react";

/**
 * A titled group that folds open and closed: a native `<details>`, so it needs no client JS.
 * The header shows the title, an optional note (such as "2 need review"), a count and a chevron.
 */
export function Fold({
  title,
  count,
  note,
  open,
  children,
}: {
  title: string;
  count: number;
  note?: React.ReactNode;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="group">
      <summary className="-mx-3 flex cursor-pointer list-none items-center gap-3 rounded-[10px] px-3 py-3 transition-colors hover:bg-fill [&::-webkit-details-marker]:hidden">
        <h2 className="eyebrow flex-1">{title}</h2>
        {note}
        <span className="num text-[14px] text-muted">{count}</span>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
