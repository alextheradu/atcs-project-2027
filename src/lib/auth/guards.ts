/** Pure authorization helpers. The session-reading wrappers live in ./index.ts. */
import type { Department, Role } from "./policy";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  departments: Department[];
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("You do not have access to this.");
    this.name = "ForbiddenError";
  }
}

export function assertRole(user: SessionUser | null, roles: readonly Role[]): SessionUser {
  if (!user) throw new UnauthenticatedError();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export function ownsResource(user: SessionUser, ownerId: string | null | undefined): boolean {
  return !!ownerId && user.id === ownerId;
}

export function canDemoteAdmin(args: { adminCount: number; targetIsAdmin: boolean; newRole: Role }): boolean {
  if (!args.targetIsAdmin || args.newRole === "ADMIN") return true;
  return args.adminCount > 1;
}
