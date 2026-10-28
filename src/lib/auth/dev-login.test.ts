import { describe, expect, it } from "vitest";
import { isDevAuthEnabled } from "./dev-login";

describe("isDevAuthEnabled", () => {
  it("is on only in non-production with DEV_AUTH=true", () => {
    expect(isDevAuthEnabled({ NODE_ENV: "development", DEV_AUTH: "true" })).toBe(true);
    expect(isDevAuthEnabled({ NODE_ENV: "test", DEV_AUTH: "true" })).toBe(true);
  });
  it("is off in production even with the flag", () => {
    expect(isDevAuthEnabled({ NODE_ENV: "production", DEV_AUTH: "true" })).toBe(false);
  });
  it("is off without the flag or with other values", () => {
    expect(isDevAuthEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isDevAuthEnabled({ NODE_ENV: "development", DEV_AUTH: "1" })).toBe(false);
    expect(isDevAuthEnabled({ NODE_ENV: "development", DEV_AUTH: "TRUE" })).toBe(false);
  });
  it("is off when NODE_ENV is unset", () => {
    expect(isDevAuthEnabled({ DEV_AUTH: "true" })).toBe(false);
  });
});
