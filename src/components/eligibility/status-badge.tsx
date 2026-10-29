import { Badge } from "@/components/ui/badge";
import { ELIGIBILITY_TONE, eligibilityLabel, type EvalResult } from "@/lib/eligibility";

export function EligibilityBadge({ result, className }: { result: Pick<EvalResult, "status" | "viaAppeal" | "summary">; className?: string }) {
  return (
    <span title={result.summary}>
      <Badge tone={result.viaAppeal ? "eligible" : ELIGIBILITY_TONE[result.status]} className={className}>
        {eligibilityLabel(result)}
      </Badge>
    </span>
  );
}
