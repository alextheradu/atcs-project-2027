/** In-memory sliding window limiter. Fine for a single container. */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter(opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function check(key: string, cfg: RateLimitConfig): RateLimitResult {
    const t = now();
    const cutoff = t - cfg.windowMs;
    const recent = (hits.get(key) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= cfg.limit) {
      hits.set(key, recent);
      return { ok: false, remaining: 0, retryAfterMs: recent[0] + cfg.windowMs - t };
    }

    recent.push(t);
    hits.set(key, recent);
    return { ok: true, remaining: cfg.limit - recent.length, retryAfterMs: 0 };
  }

  /** Drop idle keys so the map cannot grow without bound. */
  function sweep(maxWindowMs: number) {
    const cutoff = now() - maxWindowMs;
    for (const [key, list] of hits) {
      if (list.every((ts) => ts <= cutoff)) hits.delete(key);
    }
  }

  return { check, sweep };
}

/** Named buckets from the spec. */
export const LIMITS = {
  signIn: { limit: 10, windowMs: 10 * 60_000 },
  appeal: { limit: 10, windowMs: 60 * 60_000 },
  plan: { limit: 30, windowMs: 60 * 60_000 },
  import: { limit: 10, windowMs: 60 * 60_000 },
  export: { limit: 5, windowMs: 60 * 60_000 },
  deletion: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

export type LimitName = keyof typeof LIMITS;

const globalForLimiter = globalThis as unknown as { __limiter?: ReturnType<typeof createRateLimiter> };
const shared = (globalForLimiter.__limiter ??= createRateLimiter());

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("Too many requests. Try again later.");
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError when the bucket is exhausted. Key by user id or IP. */
export function enforceLimit(name: LimitName, key: string) {
  const r = shared.check(`${name}:${key}`, LIMITS[name]);
  if (!r.ok) throw new RateLimitError(r.retryAfterMs);
}
