import { describe, expect, it, vi } from "vitest";
import { decideSignIn, type SignInDeps } from "./signin-decision";
import type { PolicyResult } from "./policy";

const allowStudent: PolicyResult = {
  allow: true,
  role: "STUDENT",
  cohort: "CURRENT",
  departments: [],
  source: "domain",
};

function deps(over: Partial<SignInDeps> = {}): SignInDeps {
  return {
    accountOwner: async () => null,
    sessionUserId: async () => null,
    linkIntent: async () => null,
    userByEmail: async () => null,
    policy: async () => allowStudent,
    applyToExisting: vi.fn(async () => {}),
    ...over,
  };
}
const input = { email: "b@gmail.com", verified: true };

describe("signed in, new Google account (the link path)", () => {
  it("denies silent linking without an intent", async () => {
    const d = deps({ sessionUserId: async () => "A" });
    expect(await decideSignIn(input, d)).toBe("/settings?link=denied");
  });
  it("denies an intent that belongs to someone else", async () => {
    const d = deps({ sessionUserId: async () => "A", linkIntent: async () => ({ userId: "Z" }) });
    expect(await decideSignIn(input, d)).toBe("/settings?link=denied");
  });
  it("denies an unverified second email", async () => {
    const d = deps({ sessionUserId: async () => "A", linkIntent: async () => ({ userId: "A" }) });
    expect(await decideSignIn({ ...input, verified: false }, d)).toBe("/settings?link=unverified");
  });
  it("denies when the email already belongs to another user", async () => {
    const d = deps({
      sessionUserId: async () => "A",
      linkIntent: async () => ({ userId: "A" }),
      userByEmail: async () => ({ id: "B" }),
    });
    expect(await decideSignIn(input, d)).toBe("/settings?link=taken");
  });
  it("allows a valid link and skips the signup policy", async () => {
    const policy = vi.fn(async () => allowStudent);
    const d = deps({ sessionUserId: async () => "A", linkIntent: async () => ({ userId: "A" }), policy });
    expect(await decideSignIn(input, d)).toBe(true);
    expect(policy).not.toHaveBeenCalled();
  });
  it("allows linking an email that already resolves to the same user", async () => {
    const d = deps({
      sessionUserId: async () => "A",
      linkIntent: async () => ({ userId: "A" }),
      userByEmail: async () => ({ id: "A" }),
    });
    expect(await decideSignIn(input, d)).toBe(true);
  });
});

describe("normal sign-in", () => {
  it("redirects with the policy reason when denied", async () => {
    const d = deps({ policy: async () => ({ allow: false, reason: "domain_not_allowed" }) });
    expect(await decideSignIn(input, d)).toBe("/?error=domain_not_allowed");
  });
  it("allows a brand new user and applies nothing to existing", async () => {
    const d = deps();
    expect(await decideSignIn(input, d)).toBe(true);
    expect(d.applyToExisting).not.toHaveBeenCalled();
  });
  it("applies the policy to a returning user found by account", async () => {
    const d = deps({ accountOwner: async () => ({ userId: "U1" }) });
    expect(await decideSignIn(input, d)).toBe(true);
    expect(d.applyToExisting).toHaveBeenCalledWith("U1", allowStudent);
  });
  it("applies the policy to an existing user found by email or linked email", async () => {
    const d = deps({ userByEmail: async () => ({ id: "U2" }) });
    await decideSignIn(input, d);
    expect(d.applyToExisting).toHaveBeenCalledWith("U2", allowStudent);
  });
  it("a known account with a stale session is a normal sign-in, not a link", async () => {
    const d = deps({ accountOwner: async () => ({ userId: "U1" }), sessionUserId: async () => "U1" });
    expect(await decideSignIn(input, d)).toBe(true);
  });
});
