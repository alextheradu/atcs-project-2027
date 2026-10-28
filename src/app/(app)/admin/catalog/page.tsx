export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CsvImport } from "@/components/catalog/csv-import";
import { requirePageRole } from "@/lib/auth/page";
import { DEPT_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
import { db } from "@/lib/db";

export default async function CatalogAdmin({ searchParams }: { searchParams: Promise<{ q?: string; review?: string }> }) {
  await requirePageRole("COUNSELOR", "ADMIN");
  const { q = "", review } = await searchParams;
  const needle = q.slice(0, 100);

  const [courses, provisional] = await Promise.all([
    db.course.findMany({
      where: {
        ...(needle ? { OR: [{ name: { contains: needle, mode: "insensitive" } }, { slug: { contains: needle, mode: "insensitive" } }] } : {}),
        ...(review ? { requirements: { some: { provisional: true } } } : {}),
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: { requirements: { select: { kind: true, provisional: true } } },
    }),
    db.courseRequirement.count({ where: { provisional: true } }),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="mt-1 text-muted">Add, edit and archive courses. Every change is audited.</p>
        </div>
        <div className="flex gap-2">
          <a className="btn" href="/admin/catalog/export" download>Export CSV</a>
          <Link className="btn btn-primary" href="/admin/catalog/new">New course</Link>
        </div>
      </header>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="text-sm">
          <span className="font-mono">{provisional}</span> requirement tags need counselor review.
          <span className="text-muted"> These count toward graduation meters but are marked unconfirmed.</span>
        </div>
        <Link className="btn btn-sm" href={review ? "/admin/catalog" : "/admin/catalog?review=1"}>
          {review ? "Show all" : "Show only courses needing review"}
        </Link>
      </section>

      <form action="/admin/catalog" className="flex gap-2">
        {review && <input type="hidden" name="review" value="1" />}
        <input className="input !w-72" name="q" defaultValue={q} placeholder="Search name or slug" aria-label="Search" />
        <button className="btn" type="submit">Search</button>
      </form>

      <p className="font-mono text-xs text-muted">{courses.length} courses</p>
      <ul className="card divide-y divide-line">
        {courses.map((c) => {
          const prov = c.requirements.filter((r) => r.provisional).length;
          return (
            <li key={c.id}>
              <Link href={`/admin/catalog/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-elevated">
                <span className="min-w-0">
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-xs text-muted">{DEPT_LABEL[c.department]} · {LEVEL_LABEL[c.level]}</span>
                </span>
                <span className="flex items-center gap-2">
                  {c.archived && <Badge tone="locked">Archived</Badge>}
                  {prov > 0 && <Badge tone="warning">Needs counselor review</Badge>}
                  <span className="font-mono text-xs text-muted">{fmtCredits(c.credits)} cr</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="card p-4"><CsvImport /></section>
    </div>
  );
}
