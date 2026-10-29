import { timingSafeEqual } from "node:crypto";

/**
 * Checks a cron request's secret in constant time. The header is `Authorization: Bearer <secret>`.
 * An unset or empty secret rejects everything, so a missing env var can never open the route.
 */
export function cronAuthorized(header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  // Compare equal length buffers so the check does not leak the length through an early return.
  const padded = Buffer.alloc(b.length);
  a.copy(padded, 0, 0, b.length);
  return timingSafeEqual(padded, b) && a.length === b.length;
}
