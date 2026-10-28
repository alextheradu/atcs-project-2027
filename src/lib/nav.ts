import type { Role } from "@/lib/auth/policy";

export interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

/** Add an item here in the phase that builds its page. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
  { href: "/admin/settings", label: "Admin settings", roles: ["ADMIN"] },
  { href: "/settings", label: "Settings" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => !i.roles || i.roles.includes(role));
}
