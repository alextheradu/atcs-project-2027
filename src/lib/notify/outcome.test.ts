import { describe, expect, it } from "vitest";
import { emailOutcome, pushOutcome } from "./outcome";
import { MAX_ATTEMPTS } from "./policy";

const now = new Date("2027-01-01T00:00:00Z");

describe("emailOutcome", () => {
  it("marks a sent email done", () => {
    expect(emailOutcome(1, { ok: true }, now)).toMatchObject({ status: "SENT", nextAttemptAt: null, lastError: null });
  });
  it("retries a transient failure with a backoff, and records why", () => {
    const o = emailOutcome(1, { ok: false, error: "timeout" }, now);
    expect(o).toMatchObject({ status: "PENDING", lastError: "timeout" });
    expect(o.nextAttemptAt!.getTime()).toBeGreaterThan(now.getTime());
  });
  it("stops after the maximum attempts", () => {
    expect(emailOutcome(MAX_ATTEMPTS, { ok: false, error: "timeout" }, now)).toMatchObject({ status: "FAILED", nextAttemptAt: null });
  });
  it("stops at once on a permanent failure", () => {
    expect(emailOutcome(1, { ok: false, permanent: true, error: "email not configured" }, now).status).toBe("FAILED");
  });
  it("clips long error text", () => {
    expect(emailOutcome(1, { ok: false, error: "x".repeat(900) }, now).lastError!.length).toBe(300);
  });
});

describe("pushOutcome", () => {
  it("is sent when any device accepted it", () => {
    const o = pushOutcome(1, [{ endpoint: "a", ok: true }, { endpoint: "b", ok: false, error: "x" }], now);
    expect(o.status).toBe("SENT");
  });
  it("removes devices the service reports gone (404 or 410) without counting a failure", () => {
    const o = pushOutcome(1, [{ endpoint: "a", ok: true }, { endpoint: "b", ok: false, gone: true }], now);
    expect(o).toMatchObject({ status: "SENT", deleteEndpoints: ["b"] });
  });
  it("is skipped when every device is gone or there are none", () => {
    expect(pushOutcome(1, [{ endpoint: "a", ok: false, gone: true }], now)).toMatchObject({ status: "SKIPPED", deleteEndpoints: ["a"] });
    expect(pushOutcome(1, [], now)).toMatchObject({ status: "SKIPPED", lastError: "no device subscribed" });
  });
  it("retries when every live device failed, then gives up", () => {
    expect(pushOutcome(1, [{ endpoint: "a", ok: false, error: "503" }], now).status).toBe("PENDING");
    expect(pushOutcome(MAX_ATTEMPTS, [{ endpoint: "a", ok: false, error: "503" }], now)).toMatchObject({ status: "FAILED", lastError: "503" });
  });
});
