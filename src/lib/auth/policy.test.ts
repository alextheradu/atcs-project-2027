import { describe, expect, it } from "vitest";
import { evaluateSignIn, isStaffRole, normalizeEmail, type PolicyInput } from "./policy";

const base: PolicyInput = {
  email: "kid@pascack.org",
  emailVerified: true,
  mode: "DOMAIN_ALLOWLIST",
  allowedDomains: [
    { domain: "pascack.org", cohort: "CURRENT", enabled: true },
    { domain: "hillsdale.example", cohort: "INCOMING_8", enabled: true },
  ],
  grant: null,
  adminEmails: [],
  existingUser: false,
};

const run = (over: Partial<PolicyInput>) => evaluateSignIn({ ...base, ...over });

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Kid@Pascack.ORG ")).toBe("kid@pascack.org");
  });
});

describe("isStaffRole", () => {
  it("flags counselor, supervisor, admin only", () => {
    expect(isStaffRole("COUNSELOR")).toBe(true);
    expect(isStaffRole("SUPERVISOR")).toBe(true);
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("STUDENT")).toBe(false);
    expect(isStaffRole("INCOMING")).toBe(false);
  });
});

describe("evaluateSignIn: verification", () => {
  it("rejects unverified email even for admin env emails", () => {
    const r = run({ emailVerified: false, adminEmails: ["kid@pascack.org"] });
    expect(r).toMatchObject({ allow: false, reason: "email_not_verified" });
  });
});

describe("evaluateSignIn: DOMAIN_ALLOWLIST", () => {
  it("allows an allowed domain as a CURRENT student", () => {
    expect(run({})).toMatchObject({ allow: true, role: "STUDENT", cohort: "CURRENT", source: "domain" });
  });
  it("maps an incoming-8 domain to INCOMING", () => {
    expect(run({ email: "a@hillsdale.example" })).toMatchObject({
      allow: true,
      role: "INCOMING",
      cohort: "INCOMING_8",
    });
  });
  it("rejects an unknown domain", () => {
    expect(run({ email: "a@gmail.com" })).toMatchObject({ allow: false, reason: "domain_not_allowed" });
  });
  it("rejects a disabled domain", () => {
    const r = run({ allowedDomains: [{ domain: "pascack.org", cohort: "CURRENT", enabled: false }] });
    expect(r).toMatchObject({ allow: false, reason: "domain_not_allowed" });
  });
  it("does not match subdomains or lookalikes", () => {
    expect(run({ email: "a@mail.pascack.org" }).allow).toBe(false);
    expect(run({ email: "a@evilpascack.org" }).allow).toBe(false);
  });
});

describe("evaluateSignIn: OPEN", () => {
  it("allows anyone, student role, cohort decided in onboarding", () => {
    expect(run({ mode: "OPEN", email: "a@gmail.com" })).toMatchObject({
      allow: true,
      role: "STUDENT",
      cohort: null,
      source: "open",
    });
  });
  it("still uses the domain cohort when one matches", () => {
    expect(run({ mode: "OPEN" })).toMatchObject({ role: "STUDENT", cohort: "CURRENT" });
  });
});

describe("evaluateSignIn: INVITE_ONLY", () => {
  it("rejects without a grant", () => {
    expect(run({ mode: "INVITE_ONLY" })).toMatchObject({ allow: false, reason: "invite_required" });
  });
  it("allows with a student grant on any domain (the invite)", () => {
    const r = run({
      mode: "INVITE_ONLY",
      email: "a@gmail.com",
      grant: { role: "STUDENT", departments: [] },
    });
    expect(r).toMatchObject({ allow: true, role: "STUDENT", source: "grant" });
  });
});

describe("evaluateSignIn: staff grants", () => {
  it("applies a counselor grant for a pascack.org address", () => {
    const r = run({ grant: { role: "COUNSELOR", departments: [] } });
    expect(r).toMatchObject({ allow: true, role: "COUNSELOR", source: "grant" });
  });
  it("applies supervisor departments", () => {
    const r = run({ grant: { role: "SUPERVISOR", departments: ["MATH", "SCIENCE"] } });
    expect(r).toMatchObject({ role: "SUPERVISOR", departments: ["MATH", "SCIENCE"] });
  });
  it("drops departments for non-supervisors", () => {
    const r = run({ grant: { role: "COUNSELOR", departments: ["MATH"] } });
    expect(r).toMatchObject({ role: "COUNSELOR", departments: [] });
  });
  it("refuses a staff grant for a non-pascack address and never elevates", () => {
    const r = run({
      mode: "OPEN",
      email: "a@gmail.com",
      grant: { role: "ADMIN", departments: [] },
    });
    expect(r).toMatchObject({ allow: true, role: "STUDENT", ignoredGrant: "staff_grant_invalid_domain" });
  });
  it("refuses a staff grant on a lookalike domain", () => {
    const r = run({
      mode: "OPEN",
      email: "a@pascack.org.evil.com",
      grant: { role: "COUNSELOR", departments: [] },
    });
    expect(r).toMatchObject({ role: "STUDENT", ignoredGrant: "staff_grant_invalid_domain" });
  });
  it("a staff grant bypasses the allowlist when the domain is pascack.org", () => {
    const r = run({
      allowedDomains: [],
      grant: { role: "COUNSELOR", departments: [] },
    });
    expect(r).toMatchObject({ allow: true, role: "COUNSELOR" });
  });
});

describe("evaluateSignIn: ADMIN_EMAILS bootstrap", () => {
  it("makes a listed email admin regardless of mode and domain", () => {
    const r = run({
      mode: "INVITE_ONLY",
      email: "Owner@Gmail.com",
      adminEmails: ["owner@gmail.com"],
    });
    expect(r).toMatchObject({ allow: true, role: "ADMIN", source: "admin_env" });
  });
  it("does not match unlisted emails", () => {
    const r = run({ email: "a@gmail.com", adminEmails: ["owner@gmail.com"] });
    expect(r.allow).toBe(false);
  });
});

describe("evaluateSignIn: existing users", () => {
  it("lets existing users in regardless of mode, role unchanged", () => {
    const r = run({ existingUser: true, mode: "INVITE_ONLY", email: "a@gmail.com" });
    expect(r).toMatchObject({ allow: true, source: "existing" });
    expect(r.allow && r.role).toBe(null);
  });
  it("still bootstraps an existing user listed in ADMIN_EMAILS", () => {
    const r = run({ existingUser: true, email: "a@gmail.com", adminEmails: ["a@gmail.com"] });
    expect(r).toMatchObject({ allow: true, role: "ADMIN", source: "admin_env" });
  });
});
