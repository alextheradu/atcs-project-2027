export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import { parseRule } from "@/lib/eligibility";
import { canEditDepartment } from "@/lib/rules/scope";

type Filter = "" | "rule" | "text" | "none";

export default async function RulesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const user = await requirePageRole("ADMIN", "SUPERVISOR");
  const { q = "", f = "" } = await searchParams;
  const needle = q.slice(0, 100);
  const filter = (["rule", "text", "none"].includes(f) ? f : "") as Filter;

  const rows = await db.course.findMany({
    where: {
      archived: false,
      plannable: true,
      ...(user.role === "SUPERVISOR" ? { department: { in: user.departments } } : {}),
      ...(needle ? { name: { contains: needle, mode: "insensitive" } } : {}),
    },
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: { id: true, name: true, department: true, level: true, rules: true, prereqText: true },
  });

  const items = rows
    .map((c) => ({ ...c, state: parseRule(c.rules) ? ("rule" as const) : c.prereqText ? ("text" as const) : ("none" as const) }))
    .filter((c) => !filter || c.state === filter);
  const counts = { rule: 0, text: 0, none: 0 };
  for (const c of rows) counts[parseRule(c.rules) ? "rule" : c.prereqText ? "text" : "none"]++;

  return (
    <div>
      <PageHeader
        title="Rules"
        description={
          user.role === "SUPERVISOR"
            ? "Prerequisite rules for your departments. Every change is audited."
            : "Prerequisite rules for every course. Every change is audited."
        }
        actions={<Link className="btn btn-sm" href="/admin/edges">Pathway steps</Link>}
      />

      <form action="/admin/rules" className="flex flex-wrap items-center gap-2">
        <input className="input !w-64" name="q" defaultValue={q} placeholder="Search course name" aria-label="Search" />
        <select className="input !w-auto" name="f" defaultValue={filter} aria-label="Filter">
          <option value="">All courses</option>
          <option value="rule">Checked automatically ({counts.rule})</option>
          <option value="text">Catalog text only ({counts.text})</option>
          <option value="none">No prerequisites ({counts.none})</option>
        </select>
        <button className="btn btn-sm" type="submit">Filter</button>
      </form>

      <p className="num mb-3 mt-8 text-muted">{items.length} courses</p>
      <ul className="list list-hover">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/rules/${c.id}`} className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted">{DEPT_LABEL[c.department]} · {LEVEL_LABEL[c.level]}</span>
              </span>
              <span className="shrink-0">
                {c.state === "rule" && <Badge tone="eligible">Checked</Badge>}
                {c.state === "text" && <Badge tone="warning">Text only</Badge>}
                {c.state === "none" && <span className="text-xs text-muted">None</span>}
                {!canEditDepartment(user, c.department) && <span className="ml-2 text-xs text-muted">Read only</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
