/** Turns the result of a send into the delivery's next state. Pure. */
import { afterFailure } from "./policy";

export interface Outcome {
  status: "SENT" | "PENDING" | "FAILED" | "SKIPPED";
  nextAttemptAt: Date | null;
  lastError: string | null;
  /** Push endpoints the service says are gone. They are deleted. */
  deleteEndpoints: string[];
}

export interface EmailResult {
  ok: boolean;
  /** A bad address or an unconfigured provider. Retrying cannot help. */
  permanent?: boolean;
  error?: string;
}

export interface PushResult {
  endpoint: string;
  ok: boolean;
  /** 404 or 410: the browser unsubscribed. */
  gone?: boolean;
  error?: string;
}

const clip = (s: string | undefined) => (s ?? "unknown error").slice(0, 300);

/** `attempts` counts this try. */
export function emailOutcome(attempts: number, r: EmailResult, now: Date): Outcome {
  if (r.ok) return { status: "SENT", nextAttemptAt: null, lastError: null, deleteEndpoints: [] };
  const next = afterFailure(attempts, now, r.permanent);
  return { status: next.status, nextAttemptAt: next.status === "PENDING" ? next.nextAttemptAt : null, lastError: clip(r.error), deleteEndpoints: [] };
}

/**
 * Sent when any device accepted it. Skipped when the user has no device left. Gone devices are removed
 * and do not count as a failure. Only real failures retry.
 */
export function pushOutcome(attempts: number, results: PushResult[], now: Date): Outcome {
  const gone = results.filter((r) => r.gone).map((r) => r.endpoint);
  const live = results.filter((r) => !r.gone);
  if (live.some((r) => r.ok)) return { status: "SENT", nextAttemptAt: null, lastError: null, deleteEndpoints: gone };
  if (live.length === 0) return { status: "SKIPPED", nextAttemptAt: null, lastError: results.length ? "device unsubscribed" : "no device subscribed", deleteEndpoints: gone };
  const next = afterFailure(attempts, now);
  return { status: next.status, nextAttemptAt: next.status === "PENDING" ? next.nextAttemptAt : null, lastError: clip(live.find((r) => !r.ok)?.error), deleteEndpoints: gone };
}
