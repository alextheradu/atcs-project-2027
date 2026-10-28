/**
 * Pure signup and role policy. No framework or database imports.
 * Staff roles come only from grants (and the trusted ADMIN_EMAILS env var),
 * never from an email domain.
 */

export type Role = "STUDENT" | "INCOMING" | "COUNSELOR" | "SUPERVISOR" | "ADMIN";
export type Cohort = "CURRENT" | "INCOMING_8";
export type SignupMode = "DOMAIN_ALLOWLIST" | "OPEN" | "INVITE_ONLY";
export type Department =
  | "ENGLISH"
  | "SOCIAL_STUDIES"
  | "MATH"
  | "COMPUTER_SCIENCE"
  | "SCIENCE"
  | "WORLD_LANGUAGE"
  | "ART"
  | "BUSINESS"
  | "FAMILY_CONSUMER_SCIENCES"
  | "HEALTH_PE"
  | "MUSIC"
  | "TECHNOLOGY"
  | "SPECIAL_ED"
  | "OTHER";

export const STAFF_DOMAIN = "pascack.org";

export interface PolicyInput {
  email: string;
  emailVerified: boolean;
  mode: SignupMode;
  allowedDomains: { domain: string; cohort: Cohort; enabled: boolean }[];
  grant: { role: Role; departments: Department[] } | null;
  adminEmails: string[];
  /** The email already resolves to a user (directly or through a linked email). */
  existingUser: boolean;
}

export type PolicyResult =
  | {
      allow: true;
      /** null means leave an existing user's role alone. */
      role: Role | null;
      cohort: Cohort | null;
      departments: Department[];
      source: "admin_env" | "grant" | "domain" | "open" | "existing";
      /** Set when a grant was present but not honored. */
      ignoredGrant?: "staff_grant_invalid_domain";
    }
  | {
      allow: false;
      reason: "email_not_verified" | "domain_not_allowed" | "invite_required";
    };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

export function isStaffRole(role: Role): boolean {
  return role === "COUNSELOR" || role === "SUPERVISOR" || role === "ADMIN";
}

export function evaluateSignIn(input: PolicyInput): PolicyResult {
  if (!input.emailVerified) return { allow: false, reason: "email_not_verified" };

  const email = normalizeEmail(input.email);
  const domain = emailDomain(email);
  const domainRow = input.allowedDomains.find((d) => d.enabled && d.domain.toLowerCase() === domain);
  const domainCohort = domainRow?.cohort ?? null;

  // The env var is operator controlled, so it is trusted and bypasses everything.
  if (input.adminEmails.map(normalizeEmail).includes(email)) {
    return { allow: true, role: "ADMIN", cohort: domainCohort, departments: [], source: "admin_env" };
  }

  let ignoredGrant: "staff_grant_invalid_domain" | undefined;
  let grant = input.grant;
  if (grant && isStaffRole(grant.role) && domain !== STAFF_DOMAIN) {
    ignoredGrant = "staff_grant_invalid_domain";
    grant = null;
  }

  if (grant) {
    return {
      allow: true,
      role: grant.role,
      cohort: domainCohort,
      departments: grant.role === "SUPERVISOR" ? grant.departments : [],
      source: "grant",
    };
  }

  if (input.existingUser) {
    return { allow: true, role: null, cohort: domainCohort, departments: [], source: "existing", ignoredGrant };
  }

  const roleForCohort: Role = domainCohort === "INCOMING_8" ? "INCOMING" : "STUDENT";

  switch (input.mode) {
    case "OPEN":
      return { allow: true, role: roleForCohort, cohort: domainCohort, departments: [], source: "open", ignoredGrant };
    case "DOMAIN_ALLOWLIST":
      if (!domainRow) return { allow: false, reason: "domain_not_allowed" };
      return { allow: true, role: roleForCohort, cohort: domainCohort, departments: [], source: "domain", ignoredGrant };
    case "INVITE_ONLY":
      return { allow: false, reason: "invite_required" };
  }
}
