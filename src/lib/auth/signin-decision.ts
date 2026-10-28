import type { PolicyResult } from "./policy";

type Allowed = Extract<PolicyResult, { allow: true }>;

export interface SignInDeps {
  /** The user who owns this Google account, if it was linked before. */
  accountOwner(): Promise<{ userId: string } | null>;
  /** The user behind the current session cookie, if any. */
  sessionUserId(): Promise<string | null>;
  /** A valid, signed "I am linking another email" token. */
  linkIntent(): Promise<{ userId: string } | null>;
  /** Primary or linked email lookup. */
  userByEmail(email: string): Promise<{ id: string } | null>;
  policy(): Promise<PolicyResult>;
  applyToExisting(userId: string, result: Allowed): Promise<void>;
}

/** Returns true to allow, or a redirect path to deny. */
export async function decideSignIn(input: { email: string; verified: boolean }, deps: SignInDeps): Promise<true | string> {
  const owner = await deps.accountOwner();

  if (!owner) {
    const sessionUserId = await deps.sessionUserId();
    // Auth.js silently links a new Google account to whoever is signed in.
    // Only allow that when the user explicitly started the link flow.
    if (sessionUserId) {
      const intent = await deps.linkIntent();
      if (!intent || intent.userId !== sessionUserId) return "/settings?link=denied";
      if (!input.verified) return "/settings?link=unverified";
      const other = await deps.userByEmail(input.email);
      if (other && other.id !== sessionUserId) return "/settings?link=taken";
      return true;
    }
  }

  const result = await deps.policy();
  if (!result.allow) return `/?error=${result.reason}`;

  const existingId = owner?.userId ?? (await deps.userByEmail(input.email))?.id;
  if (existingId) await deps.applyToExisting(existingId, result);
  return true;
}
