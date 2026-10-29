import { describe, expect, it } from "vitest";
import { AGE_TTL_MS, signAge, verifyAge } from "./index";

const S = "test-secret";
describe("age gate cookie", () => {
  it("round trips both answers", () => {
    expect(verifyAge(signAge("over13", S), S)).toBe("over13");
    expect(verifyAge(signAge("under13", S), S)).toBe("under13");
  });
  it("rejects a tampered, wrong-secret, expired or malformed token", () => {
    const t = signAge("under13", S, 1000);
    expect(verifyAge(t, "other", 1000)).toBeNull();
    expect(verifyAge(t, S, 1000 + AGE_TTL_MS + 1)).toBeNull();
    const [p, sig] = signAge("under13", S).split(".");
    const forged = Buffer.from(JSON.stringify({ a: "over13", exp: Date.now() + 1e9 })).toString("base64url");
    expect(verifyAge(`${forged}.${sig}`, S)).toBeNull();
    expect(verifyAge(p, S)).toBeNull();
    expect(verifyAge(undefined, S)).toBeNull();
    expect(verifyAge("a.b.c", S)).toBeNull();
  });
  it("stores no age: the token carries only the answer and an expiry", () => {
    const body = JSON.parse(Buffer.from(signAge("over13", S).split(".")[0], "base64url").toString());
    expect(Object.keys(body).sort()).toEqual(["a", "exp"]);
  });
});
