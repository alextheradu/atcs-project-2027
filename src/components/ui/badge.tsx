import { cn } from "@/lib/utils";

const tones = {
  eligible: "badge-eligible",
  warning: "badge-warning",
  appeal: "badge-appeal",
  locked: "badge-locked",
  review: "badge-review",
  neutral: "",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}
