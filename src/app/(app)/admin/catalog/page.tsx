export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/ui/page";
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
    <div>
      <PageHeader
        title="Catalog"
        description="Add, edit and archive courses. Every change is audited."
        actions={
          <>
            <a className="btn btn-sm" href="/admin/catalog/export" download>Export CSV</a>
            <Link className="btn btn-sm btn-primary" href="/admin/catalog/new">New course</Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-3 text-[13px]">
        <p>
          <span className="num text-fg">{provisional}</span> <span className="text-muted">requirement tags need counselor review. They count toward the graduation meters but show as unconfirmed.</span>
        </p>
        <Link className="btn btn-sm btn-ghost" href={review ? "/admin/catalog" : "/admin/catalog?review=1"}>
          {review ? "Show all" : "Only needing review"}
        </Link>
      </div>

      <form action="/admin/catalog" className="mt-6 flex gap-2">
        {review && <input type="hidden" name="review" value="1" />}
        <input className="input !w-72" name="q" defaultValue={q} placeholder="Search name or slug" aria-label="Search" />
        <button className="btn btn-sm" type="submit">Search</button>
      </form>

      <p className="num mb-3 mt-8 text-muted">{courses.length} courses</p>
      <ul className="list list-hover">
        {courses.map((c) => {
          const prov = c.requirements.filter((r) => r.provisional).length;
          return (
            <li key={c.id}>
              <Link href={`/admin/catalog/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-3 text-[13px] text-muted">{DEPT_LABEL[c.department]} · {LEVEL_LABEL[c.level]}</span>
                </span>
                <span className="flex items-center gap-3">
                  {c.archived && <Badge tone="locked">Archived</Badge>}
                  {prov > 0 && <Badge tone="warning">Needs review</Badge>}
                  <span className="num w-12 text-right text-muted">{fmtCredits(c.credits)} cr</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Section className="mt-12"><CsvImport /></Section>
    </div>
  );
}
