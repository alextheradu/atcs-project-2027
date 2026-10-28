import { cn } from "@/lib/utils";

/** Travelling glint along the edge of one key call to action. Use sparingly. */
export function StarBorder({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("star-border", className)}>{children}</span>;
}
