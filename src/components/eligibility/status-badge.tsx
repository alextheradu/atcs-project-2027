import { Badge } from "@/components/ui/badge";
import { displayStatus, type EvalResult } from "@/lib/eligibility";

/** The one status label for a class. The reason is always printed next to it, so there is no tooltip to hunt for. */
export function EligibilityBadge({ result, className }: { result: Pick<EvalResult, "status" | "viaAppeal" | "unmet"> & { taken?: boolean }; className?: string }) {
  const s = displayStatus(result);
  return <Badge tone={s.tone} className={className}>{s.label}</Badge>;
}
