import { db } from "@/lib/db";
import {
  evaluateSignIn,
  normalizeEmail,
  type Department,
  type PolicyInput,
  type Role,
  type SignupMode,
} from "./policy";

const MODES: SignupMode[] = ["DOMAIN_ALLOWLIST", "OPEN", "INVITE_ONLY"];

export function isSignupMode(v: unknown): v is SignupMode {
  return typeof v === "string" && (MODES as string[]).includes(v);
}

export async function getSignupMode(): Promise<SignupMode> {
  const row = await db.appSetting.findUnique({ where: { key: "signupMode" } });
  if (row && isSignupMode(row.value)) return row.value;
  const fromEnv = process.env.SIGNUP_MODE_DEFAULT;
  return isSignupMode(fromEnv) ? fromEnv : "DOMAIN_ALLOWLIST";
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

/** Finds a user by primary email, falling back to a verified linked email. */
export async function findUserByAnyEmail(email: string) {
  const e = normalizeEmail(email);
  const direct = await db.user.findUnique({ where: { email: e } });
  if (direct) return direct;
  const linked = await db.linkedEmail.findUnique({ where: { email: e }, include: { user: true } });
  return linked?.user ?? null;
}

export async function loadPolicyInput(email: string, emailVerified: boolean): Promise<PolicyInput> {
  const e = normalizeEmail(email);
  const [mode, allowedDomains, grant, existing] = await Promise.all([
    getSignupMode(),
    db.allowedDomain.findMany(),
    db.roleGrant.findUnique({ where: { email: e } }),
    findUserByAnyEmail(e),
  ]);
  return {
    email: e,
    emailVerified,
    mode,
    allowedDomains,
    // Only grants that have not been applied yet can set a role.
    grant: grant && !grant.appliedAt ? { role: grant.role as Role, departments: grant.departments as Department[] } : null,
    adminEmails: getAdminEmails(),
    existingUser: !!existing,
  };
}

export async function evaluateForEmail(email: string, emailVerified: boolean) {
  return evaluateSignIn(await loadPolicyInput(email, emailVerified));
}
