import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  const make = () => {
    let now = 0;
    const limiter = createRateLimiter({ now: () => now });
    return { limiter, tick: (ms: number) => (now += ms) };
  };

  it("allows up to the limit then blocks", () => {
    const { limiter } = make();
    const cfg = { limit: 3, windowMs: 1000 };
    expect(limiter.check("k", cfg).ok).toBe(true);
    expect(limiter.check("k", cfg).ok).toBe(true);
    expect(limiter.check("k", cfg).ok).toBe(true);
    const blocked = limiter.check("k", cfg);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("frees slots as the window slides", () => {
    const { limiter, tick } = make();
    const cfg = { limit: 2, windowMs: 1000 };
    limiter.check("k", cfg);
    tick(600);
    limiter.check("k", cfg);
    expect(limiter.check("k", cfg).ok).toBe(false);
    tick(500); // first hit is now 1100ms old
    expect(limiter.check("k", cfg).ok).toBe(true);
    expect(limiter.check("k", cfg).ok).toBe(false);
  });

  it("keeps keys independent", () => {
    const { limiter } = make();
    const cfg = { limit: 1, windowMs: 1000 };
    expect(limiter.check("a", cfg).ok).toBe(true);
    expect(limiter.check("b", cfg).ok).toBe(true);
    expect(limiter.check("a", cfg).ok).toBe(false);
  });

  it("reports retryAfterMs until the oldest hit expires", () => {
    const { limiter, tick } = make();
    const cfg = { limit: 1, windowMs: 1000 };
    limiter.check("k", cfg);
    tick(250);
    expect(limiter.check("k", cfg).retryAfterMs).toBe(750);
  });

  it("does not count blocked attempts against the window", () => {
    const { limiter, tick } = make();
    const cfg = { limit: 1, windowMs: 1000 };
    limiter.check("k", cfg);
    tick(500);
    limiter.check("k", cfg); // blocked
    tick(501);
    expect(limiter.check("k", cfg).ok).toBe(true);
  });
});
