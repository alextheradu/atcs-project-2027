import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";
import { createAdapter } from "./adapter";
import { decideSignIn } from "./signin-decision";
import { LINK_INTENT_COOKIE, verifyLinkIntent } from "./link-intent";
import { applyToExistingUser } from "./apply";
import { evaluateSignIn, normalizeEmail, type Department, type Role } from "./policy";
import { findUserByAnyEmail, loadPolicyInput } from "./service";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

async function readLinkIntent() {
  const token = (await cookies()).get(LINK_INTENT_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  return verifyLinkIntent(token, secret);
}

async function currentSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    const token = jar.get(name)?.value;
    if (!token) continue;
    const s = await db.session.findUnique({ where: { sessionToken: token } });
    if (s && s.expires > new Date()) return s.userId;
  }
  return null;
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  providers: [Google({ allowDangerousEmailAccountLinking: true })],
  session: { strategy: "database" },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || !profile?.email) return false;
      const email = normalizeEmail(profile.email);
      const verified = profile.email_verified === true;

      try {
        enforceLimit("signIn", await clientKey());
      } catch (e) {
        if (e instanceof RateLimitError) return "/?error=rate_limited";
        throw e;
      }

      return decideSignIn(
        { email, verified },
        {
          accountOwner: async () => {
            const a = await db.account.findUnique({
              where: {
                provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId },
              },
            });
            return a ? { userId: a.userId } : null;
          },
          sessionUserId: currentSessionUserId,
          linkIntent: readLinkIntent,
          userByEmail: findUserByAnyEmail,
          policy: async () => evaluateSignIn(await loadPolicyInput(email, verified)),
          applyToExisting: (userId, result) => applyToExistingUser(userId, email, result),
        },
      );
    },
    async session({ session, user }) {
      const u = user as unknown as { id: string; role: Role; departments: Department[] };
      session.user.id = u.id;
      session.user.role = u.role;
      session.user.departments = u.departments;
      return session;
    },
  },
  events: {
    async linkAccount({ user, profile }) {
      const intent = await readLinkIntent();
      if (!intent || intent.userId !== user.id || !profile?.email) return;
      const email = normalizeEmail(profile.email);
      if (email === normalizeEmail(user.email ?? "")) return;

      await db.$transaction(async (tx) => {
        await tx.linkedEmail.upsert({
          where: { email },
          create: { userId: user.id!, email, verifiedAt: new Date() },
          update: {},
        });
        await writeAudit(
          { actor: null, action: "user.email_linked", entityType: "User", entityId: user.id, after: { linked: true } },
          tx,
        );
      });
      (await cookies()).delete(LINK_INTENT_COOKIE);
    },
  },
});
