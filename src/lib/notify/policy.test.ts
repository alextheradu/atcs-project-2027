import { describe, expect, it } from "vitest";
import { KINDS, MAX_ATTEMPTS, afterFailure, channelsFor, defaultPref, isEmailLocked, pushPayload, redactEmail } from "./policy";

describe("defaults and channels", () => {
  it("in app is always on, push is off, email is on for decisions", () => {
    for (const k of KINDS) {
      expect(defaultPref(k).inApp).toBe(true);
      expect(defaultPref(k).push).toBe(false);
    }
    expect(defaultPref("APPEAL_DECIDED").email).toBe(true);
    expect(defaultPref("PLAN_APPROVED").email).toBe(true);
    expect(defaultPref("PLAN_COMMENT").email).toBe(false);
    expect(defaultPref("APPEAL_SUBMITTED").email).toBe(false);
  });
  it("queues only the channels the user wants", () => {
    expect(channelsFor("APPEAL_DECIDED", null)).toEqual(["EMAIL"]);
    expect(channelsFor("PLAN_COMMENT", null)).toEqual([]);
    expect(channelsFor("PLAN_COMMENT", { inApp: true, email: true, push: true })).toEqual(["EMAIL", "PUSH"]);
    expect(channelsFor("APPEAL_DECIDED", { inApp: true, email: false, push: false })).toEqual([]);
  });
  it("account safety emails cannot be switched off", () => {
    expect(isEmailLocked("DELETION_CONFIRM")).toBe(true);
    expect(channelsFor("DELETION_CONFIRM", { inApp: true, email: false, push: false })).toEqual(["EMAIL"]);
    expect(isEmailLocked("APPEAL_DECIDED")).toBe(false);
  });
});

describe("afterFailure", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  it("retries with growing delays", () => {
    const mins = [1, 2, 3, 4].map((a) => (afterFailure(a, now).nextAttemptAt.getTime() - now.getTime()) / 60_000);
    expect(mins).toEqual([1, 5, 15, 60]);
    for (const a of [1, 2, 3, 4]) expect(afterFailure(a, now).status).toBe("PENDING");
  });
  it("gives up after the last attempt", () => {
    expect(afterFailure(MAX_ATTEMPTS, now).status).toBe("FAILED");
    expect(afterFailure(MAX_ATTEMPTS + 3, now).status).toBe("FAILED");
  });
  it("stops at once on a permanent failure", () => {
    expect(afterFailure(1, now, true).status).toBe("FAILED");
  });
  it("never schedules in the past", () => {
    for (let a = 1; a <= MAX_ATTEMPTS; a++) expect(afterFailure(a, now).nextAttemptAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});

describe("redactEmail and pushPayload", () => {
  it("hides most of an address", () => {
    expect(redactEmail("alex@pascack.org")).toBe("a***@p***.org");
    expect(redactEmail("weird")).toContain("***");
    expect(redactEmail("alex@pascack.org")).not.toContain("alex");
  });
  it("keeps push payloads short and local", () => {
    const p = JSON.parse(pushPayload({ title: "t".repeat(200), body: "b".repeat(500), url: "/appeals/1" }));
    expect(p.title.length).toBe(80);
    expect(p.body.length).toBe(140);
    expect(p.url).toBe("/appeals/1");
    expect(JSON.parse(pushPayload({ title: "a", body: "b", url: "https://evil.example" })).url).toBe("/dashboard");
    expect(JSON.parse(pushPayload({ title: "a", body: "b", url: null })).url).toBe("/dashboard");
  });
});

import { kindsFor } from "./policy";
describe("kindsFor", () => {
  it("hides staff options from students and student options from staff", () => {
    expect(kindsFor("STUDENT")).not.toContain("PLAN_SUBMITTED");
    expect(kindsFor("STUDENT")).toContain("APPEAL_DECIDED");
    expect(kindsFor("COUNSELOR")).toContain("PLAN_SUBMITTED");
    expect(kindsFor("COUNSELOR")).not.toContain("APPEAL_DECIDED");
    expect(kindsFor("INCOMING")).toEqual(kindsFor("STUDENT"));
  });
});
