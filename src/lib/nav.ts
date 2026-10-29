import type { Role } from "@/lib/auth/policy";
import { STUDENT_WORKSPACE_ROLES } from "@/lib/auth/student-access";

export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
  group: "Workspace" | "Admin";
}

/** Add an item here in the phase that builds its page. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", group: "Workspace" },
  { href: "/plans", label: "Plans", group: "Workspace" },
  { href: "/courses", label: "Courses", group: "Workspace" },
  { href: "/import", label: "Import", roles: STUDENT_WORKSPACE_ROLES, group: "Workspace" },
  { href: "/pathways", label: "Pathways", group: "Workspace" },
  { href: "/appeals", label: "Placement reviews", roles: STUDENT_WORKSPACE_ROLES, group: "Workspace" },
  { href: "/review", label: "Reviews", roles: ["SUPERVISOR", "ADMIN"], group: "Admin" },
  { href: "/counselor", label: "Counselor", roles: ["COUNSELOR", "ADMIN"], group: "Admin" },
  { href: "/admin/catalog", label: "Catalog", roles: ["COUNSELOR", "ADMIN"], group: "Admin" },
  { href: "/admin/rules", label: "Rules", roles: ["ADMIN", "SUPERVISOR"], group: "Admin" },
  { href: "/admin/appeal-questions", label: "Appeal questions", roles: ["ADMIN", "SUPERVISOR"], group: "Admin" },
  { href: "/admin/timeline", label: "Dates", roles: ["ADMIN"], group: "Admin" },
  { href: "/admin/major-guidance", label: "College guidance", roles: ["ADMIN"], group: "Admin" },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"], group: "Admin" },
  { href: "/admin/settings", label: "Admin settings", roles: ["ADMIN"], group: "Admin" },
  { href: "/help", label: "Help", group: "Workspace" },
  { href: "/settings", label: "Settings", group: "Workspace" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => !i.roles || i.roles.includes(role));
}
