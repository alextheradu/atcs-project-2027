import type { Role } from "@/lib/auth/policy";
import { STUDENT_WORKSPACE_ROLES } from "@/lib/auth/student-access";

/**
 * Where things live. Students get two places (Board, Classes); staff add Students and Admin. Everything else is
 * reached in context or from the menu under the user's name. Roles here only decide what is shown: every page
 * still checks the role on the server, and these lists must match those checks.
 */
export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const STAFF: Role[] = ["COUNSELOR", "SUPERVISOR", "ADMIN"];

export const NAV: NavItem[] = [
  { href: "/board", label: "Board", roles: STUDENT_WORKSPACE_ROLES },
  { href: "/courses", label: "Classes" },
  { href: "/students", label: "Students", roles: STAFF },
  { href: "/admin", label: "Admin", roles: STAFF },
];

export const ADMIN_TABS: NavItem[] = [
  { href: "/admin/catalog", label: "Catalog", roles: ["COUNSELOR", "ADMIN"] },
  { href: "/admin/rules", label: "Rules", roles: ["ADMIN", "SUPERVISOR"] },
  { href: "/admin/appeal-questions", label: "Appeal questions", roles: ["ADMIN", "SUPERVISOR"] },
  { href: "/admin/timeline", label: "Dates", roles: ["ADMIN"] },
  { href: "/admin/major-guidance", label: "College guidance", roles: ["ADMIN"] },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/admin/deletions", label: "Deletions", roles: ["ADMIN"] },
  { href: "/admin/settings", label: "Settings", roles: ["ADMIN"] },
];

/** Shown under the Catalog tab. A role that cannot open Catalog sees the ones it can open as top-level tabs. */
export const CATALOG_SUBTABS: NavItem[] = [
  { href: "/admin/catalog", label: "Classes", roles: ["COUNSELOR", "ADMIN"] },
  { href: "/admin/catalog/requests", label: "Requests", roles: ["COUNSELOR", "ADMIN"] },
  { href: "/admin/edges", label: "Pathway steps", roles: ["ADMIN", "SUPERVISOR"] },
];

/** The menu under the user's name. Sign out is added by the shell. */
export const MENU: NavItem[] = [
  { href: "/appeals", label: "Placement reviews", roles: STUDENT_WORKSPACE_ROLES },
  { href: "/import", label: "Import transcript", roles: STUDENT_WORKSPACE_ROLES },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

const allowed = (role: Role) => (i: NavItem) => !i.roles || i.roles.includes(role);

export function adminTabsFor(role: Role): NavItem[] {
  const tabs = ADMIN_TABS.filter(allowed(role));
  if (tabs.some((t) => t.href === "/admin/catalog")) return tabs;
  return [...tabs, ...CATALOG_SUBTABS.filter(allowed(role))];
}

export function navFor(role: Role): NavItem[] {
  return NAV.filter(allowed(role)).filter((i) => i.href !== "/admin" || adminTabsFor(role).length > 0);
}

export function menuFor(role: Role): NavItem[] {
  return MENU.filter(allowed(role));
}

/** Where a signed-in user lands. Students and admins plan; other staff start with their work queue. */
export function homeFor(role: Role): "/board" | "/students" {
  return STUDENT_WORKSPACE_ROLES.includes(role) ? "/board" : "/students";
}
