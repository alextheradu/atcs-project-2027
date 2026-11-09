import { cn } from "@/lib/utils";

/** Used to draw a travelling glint around one call to action. The redesign has no glows, so it only wraps its child. */
export function StarBorder({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("star-border", className)}>{children}</span>;
}
