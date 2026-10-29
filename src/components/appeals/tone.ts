import type { AppealStatus } from "@/lib/appeals/rules";

export const TONE: Record<AppealStatus, "eligible" | "warning" | "appeal" | "locked" | "review" | "neutral"> = {
  DRAFT: "neutral",
  SUBMITTED: "review",
  UNDER_REVIEW: "review",
  APPROVED: "eligible",
  DENIED: "locked",
  WITHDRAWN: "neutral",
};
