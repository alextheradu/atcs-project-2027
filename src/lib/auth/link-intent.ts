import { createHmac, timingSafeEqual } from "node:crypto";

export const LINK_INTENT_COOKIE = "link_intent";
export const LINK_INTENT_TTL_MS = 10 * 60_000;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Short-lived signed token that says "this signed-in user is about to link a second Google account". */
export function signLinkIntent(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: now + LINK_INTENT_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyLinkIntent(token: string, secret: string, now = Date.now()): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: unknown; exp?: unknown };
    if (typeof data.userId !== "string" || typeof data.exp !== "number" || data.exp < now) return null;
    return { userId: data.userId };
  } catch {
    return null;
  }
}
