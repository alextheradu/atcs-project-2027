import { describe, expect, it } from "vitest";
import { signLinkIntent, verifyLinkIntent } from "./link-intent";

const secret = "test-secret";

describe("link intent token", () => {
  it("round trips the user id", () => {
    const t = signLinkIntent("user1", secret, 1_000);
    expect(verifyLinkIntent(t, secret, 1_000)).toEqual({ userId: "user1" });
  });
  it("rejects a tampered token", () => {
    const t = signLinkIntent("user1", secret, 1_000);
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "admin", exp: 9_999_999 })).toString("base64url");
    expect(verifyLinkIntent(`${forged}.${sig}`, secret, 1_000)).toBeNull();
    expect(verifyLinkIntent(`${payload}.bad`, secret, 1_000)).toBeNull();
  });
  it("rejects the wrong secret", () => {
    const t = signLinkIntent("user1", secret, 1_000);
    expect(verifyLinkIntent(t, "other", 1_000)).toBeNull();
  });
  it("expires after ten minutes", () => {
    const t = signLinkIntent("user1", secret, 0);
    expect(verifyLinkIntent(t, secret, 9 * 60_000)).not.toBeNull();
    expect(verifyLinkIntent(t, secret, 10 * 60_000 + 1)).toBeNull();
  });
  it("rejects garbage", () => {
    expect(verifyLinkIntent("", secret, 0)).toBeNull();
    expect(verifyLinkIntent("abc", secret, 0)).toBeNull();
    expect(verifyLinkIntent("a.b.c", secret, 0)).toBeNull();
  });
});
