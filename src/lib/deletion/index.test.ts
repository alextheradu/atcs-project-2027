import { describe, expect, it } from "vitest";
import { GRACE_DAYS, cancel, confirm, daysLeft, guardianStart, hashEmail, isActive, isDue, signConfirm, verifyConfirm, type DeletionState } from "./index";

const now = new Date("2026-11-01T12:00:00Z");
const DAY = 86_400_000;
const state = (o: Partial<DeletionState> = {}): DeletionState => ({ status: "AWAITING_CONFIRMATION", source: "self", scheduledFor: null, ...o });

describe("state machine", () => {
  it("confirming schedules deletion after the grace period", () => {
    const r = confirm(state(), now);
    expect(r).toMatchObject({ ok: true, status: "SCHEDULED" });
    if (r.ok) expect(r.scheduledFor?.getTime()).toBe(now.getTime() + GRACE_DAYS * DAY);
  });
  it("the grace period is 14 days", () => expect(GRACE_DAYS).toBe(14));
  it("cannot confirm twice or after cancelling", () => {
    expect(confirm(state({ status: "SCHEDULED", scheduledFor: now }), now).ok).toBe(false);
    expect(confirm(state({ status: "CANCELLED" }), now).ok).toBe(false);
    expect(confirm(state({ status: "COMPLETED" }), now).ok).toBe(false);
  });
  it("the owner can cancel while waiting or scheduled", () => {
    expect(cancel(state(), "owner")).toMatchObject({ ok: true, status: "CANCELLED" });
    expect(cancel(state({ status: "SCHEDULED", scheduledFor: now }), "owner")).toMatchObject({ ok: true, status: "CANCELLED" });
  });
  it("nothing to cancel once finished", () => {
    expect(cancel(state({ status: "COMPLETED" }), "admin").ok).toBe(false);
    expect(cancel(state({ status: "CANCELLED" }), "owner").ok).toBe(false);
  });
  it("only an admin can cancel a guardian request", () => {
    const g = state({ status: "SCHEDULED", source: "guardian", scheduledFor: now });
    expect(cancel(g, "owner").ok).toBe(false);
    expect(cancel(g, "admin")).toMatchObject({ ok: true, status: "CANCELLED" });
  });
  it("a guardian request starts scheduled, with no email step", () => {
    const g = guardianStart(now);
    expect(g.status).toBe("SCHEDULED");
    expect(g.scheduledFor.getTime()).toBe(now.getTime() + 14 * DAY);
  });
  it("is due only when scheduled and the date has passed", () => {
    const s = state({ status: "SCHEDULED", scheduledFor: new Date(now.getTime() - 1) });
    expect(isDue(s, now)).toBe(true);
    expect(isDue({ ...s, scheduledFor: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(isDue({ ...s, status: "CANCELLED" }, now)).toBe(false);
    expect(isDue({ ...s, status: "AWAITING_CONFIRMATION" }, now)).toBe(false);
    expect(isDue({ ...s, scheduledFor: null }, now)).toBe(false);
  });
  it("active means waiting or counting down", () => {
    expect(isActive(state())).toBe(true);
    expect(isActive(state({ status: "SCHEDULED" }))).toBe(true);
    expect(isActive(state({ status: "COMPLETED" }))).toBe(false);
    expect(isActive(state({ status: "CANCELLED" }))).toBe(false);
  });
  it("counts days left without going negative", () => {
    expect(daysLeft(new Date(now.getTime() + 3 * DAY), now)).toBe(3);
    expect(daysLeft(new Date(now.getTime() - DAY), now)).toBe(0);
  });
});

describe("email hash", () => {
  it("ignores case and spaces, differs by address and by secret", () => {
    expect(hashEmail(" Ada@Example.org ", "s")).toBe(hashEmail("ada@example.org", "s"));
    expect(hashEmail("ada@example.org", "s")).not.toBe(hashEmail("bob@example.org", "s"));
    expect(hashEmail("ada@example.org", "s")).not.toBe(hashEmail("ada@example.org", "t"));
  });
  it("does not contain the address", () => {
    const h = hashEmail("ada@example.org", "s");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("ada");
  });
});

describe("confirm token", () => {
  const t0 = 1_000_000;
  it("round trips", () => {
    expect(verifyConfirm(signConfirm("r1", "u1", "secret", t0), "secret", t0 + 1000)).toEqual({ requestId: "r1", userId: "u1" });
  });
  it("rejects a wrong secret, a tampered body, an expired token and junk", () => {
    const tok = signConfirm("r1", "u1", "secret", t0);
    expect(verifyConfirm(tok, "other", t0)).toBeNull();
    const [body, sig] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ r: "r2", u: "u1", exp: t0 + 99_999_999 })).toString("base64url");
    expect(verifyConfirm(`${forged}.${sig}`, "secret", t0)).toBeNull();
    expect(verifyConfirm(`${body}.${sig.slice(1)}x`, "secret", t0)).toBeNull();
    expect(verifyConfirm(tok, "secret", t0 + 25 * 60 * 60_000)).toBeNull();
    expect(verifyConfirm("nope", "secret", t0)).toBeNull();
    expect(verifyConfirm("a".repeat(700), "secret", t0)).toBeNull();
  });
  it("is not interchangeable with the link intent token", () => {
    // Same HMAC key, different domain prefix: a signature made for another purpose does not verify here.
    const payload = Buffer.from(JSON.stringify({ r: "r1", u: "u1", exp: t0 + 1000 })).toString("base64url");
    expect(verifyConfirm(`${payload}.AAAA`, "secret", t0)).toBeNull();
  });
});
