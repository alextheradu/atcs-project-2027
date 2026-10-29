export const instant = false;

import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { navFor } from "@/lib/nav";
import { countdownText, upcoming } from "@/lib/timeline";

const BLURB: Record<string, string> = {
  "/plans": "Build a four year plan and see what graduation still needs",
  "/courses": "Browse the catalog and filter by department, level and grade",
  "/admin/catalog": "Edit courses, requirement tags and aliases",
  "/admin/users": "Roles and pre-approved grants",
  "/admin/settings": "Signup mode and allowed domains",
  "/settings": "Linked emails and account",
  "/counselor": "Plans to review, open requirements and course demand",
  "/review": "Placement review requests for your departments",
  "/appeals": "Ask for a course you do not automatically qualify for",
  "/pathways": "The usual course sequences and where you stand",
  "/import": "Bring in courses from a transcript",
  "/admin/rules": "Prerequisite rules and pathway steps",
};

export default async function Dashboard() {
  const user = await requirePageUser();
  const links = navFor(user.role).filter((n) => BLURB[n.href]);
  const events = await db.timelineEvent.findMany({ orderBy: { opensAt: "asc" } });
  const next = upcoming(events.map((e) => ({ ...e, audience: e.audience as "CURRENT" | "INCOMING" | "ALL" })), user.role);
  return (
    <div>
      <PageHeader
        title={`Welcome${user.name ? `, ${user.name}` : ""}`}
        description="Your plans, requirements and what is coming up."
      />
      {next.length > 0 && (
        <Section title="Coming up">
          <ul className="list">
            {next.map((u) => (
              <li key={u.id} className="flex items-baseline justify-between gap-6 py-2.5 text-[13px]">
                <span>{u.label}</span>
                <span className="num text-muted">{countdownText(u)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
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
