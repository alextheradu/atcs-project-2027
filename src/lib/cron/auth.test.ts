import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./auth";

const S = "a-long-enough-secret-value";
describe("cronAuthorized", () => {
  it("accepts the right bearer secret", () => {
    expect(cronAuthorized(`Bearer ${S}`, S)).toBe(true);
  });
  it("rejects missing, wrong, partial, longer and differently shaped headers", () => {
    for (const h of [null, undefined, "", "Bearer ", `Bearer ${S}x`, `Bearer ${S.slice(0, -1)}`, `Bearer wrong-wrong-wrong-wrong`, S, `Basic ${S}`, `bearer ${S}`]) {
      expect(cronAuthorized(h, S), String(h)).toBe(false);
    }
  });
  it("rejects everything when the secret is unset, empty or too short", () => {
    for (const secret of [undefined, "", "short"]) {
      expect(cronAuthorized(`Bearer ${secret ?? ""}`, secret)).toBe(false);
      expect(cronAuthorized("Bearer ", secret)).toBe(false);
    }
  });
});
