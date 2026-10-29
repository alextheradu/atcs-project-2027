/** Age gate cookies. Pure. We never store an age or a birthdate, only "13 or older" or a session block. */
import { createHmac, timingSafeEqual } from "node:crypto";

export const AGE_COOKIE = "age_gate";
export const AGE_TTL_MS = 6 * 60 * 60_000;

export type AgeAnswer = "under13" | "over13";

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signAge(answer: AgeAnswer, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ a: answer, exp: now + AGE_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAge(token: string | undefined, secret: string, now = Date.now()): AgeAnswer | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a?: unknown; exp?: unknown };
    if ((data.a !== "under13" && data.a !== "over13") || typeof data.exp !== "number" || data.exp < now) return null;
    return data.a;
  } catch {
    return null;
  }
}
