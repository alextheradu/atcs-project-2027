import { cache } from "react";
import { connection } from "next/server";
import { auth } from "./config";
import { assertRole, type SessionUser } from "./guards";
import type { Role } from "./policy";

export { handlers, signIn, signOut } from "./config";
export * from "./guards";
export * from "./policy";

/** The signed-in user or null. Reads cookies, so call it behind a Suspense boundary. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Auth.js generates random values before touching request data. Opt out of prerendering first.
  await connection();
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email, name: u.name ?? null, role: u.role, departments: u.departments };
});

export async function requireUser(): Promise<SessionUser> {
  return assertRole(await getCurrentUser(), ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"]);
}

/** Call first in every server action and route handler. Throws Unauthenticated or Forbidden. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  return assertRole(await getCurrentUser(), roles);
}
