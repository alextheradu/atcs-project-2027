import type { Role } from "@/lib/auth/policy";

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
  { href: "/import", label: "Import", roles: ["STUDENT", "INCOMING"], group: "Workspace" },
  { href: "/pathways", label: "Pathways", group: "Workspace" },
  { href: "/admin/catalog", label: "Catalog", roles: ["COUNSELOR", "ADMIN"], group: "Admin" },
  { href: "/admin/rules", label: "Rules", roles: ["ADMIN", "SUPERVISOR"], group: "Admin" },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"], group: "Admin" },
  { href: "/admin/settings", label: "Admin settings", roles: ["ADMIN"], group: "Admin" },
  { href: "/help", label: "Help", group: "Workspace" },
  { href: "/settings", label: "Settings", group: "Workspace" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => !i.roles || i.roles.includes(role));
}
