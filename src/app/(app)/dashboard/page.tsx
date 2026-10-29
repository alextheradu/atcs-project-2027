export const instant = false;

import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { navFor } from "@/lib/nav";

const BLURB: Record<string, string> = {
  "/plans": "Build a four year plan and see what graduation still needs",
  "/courses": "Browse the catalog and filter by department, level and grade",
  "/admin/catalog": "Edit courses, requirement tags and aliases",
  "/admin/users": "Roles and pre-approved grants",
  "/admin/settings": "Signup mode and allowed domains",
  "/settings": "Linked emails and account",
};

export default async function Dashboard() {
  const user = await requirePageUser();
  const links = navFor(user.role).filter((n) => BLURB[n.href]);
  return (
    <div>
      <PageHeader
        title={`Welcome${user.name ? `, ${user.name}` : ""}`}
        description="Your planner, requirement tracker and pathways arrive in the next updates."
      />
      <Section title="Jump to">
        <ul className="list list-hover">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-baseline justify-between gap-6 py-3 text-sm">
                <span className="font-medium">{l.label}</span>
                <span className="text-[13px] text-muted">{BLURB[l.href]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
