import type { Role } from "./policy";

/** Student tools operate on the signed-in user's own data, including for admins. */
export const STUDENT_WORKSPACE_ROLES: Role[] = ["STUDENT", "INCOMING", "ADMIN"];

export function canUseStudentWorkspace(role: Role): boolean {
  return STUDENT_WORKSPACE_ROLES.includes(role);
}
