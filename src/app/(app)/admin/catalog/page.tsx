export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Fold } from "@/components/ui/fold";
import { PageHeader, Section } from "@/components/ui/page";
import { CsvImport } from "@/components/catalog/csv-import";
import { MoveToOther } from "@/components/catalog/move-to-other";
import { requirePageRole } from "@/lib/auth/page";
import { rowFor } from "@/lib/board";
import { DEPT_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
import { db } from "@/lib/db";
import type { RequirementKind } from "@/lib/requirements";
import { cn } from "@/lib/utils";

// Results at or under this many courses open every department, same as Classes.
const OPEN_ALL_UP_TO = 20;

export default async function CatalogAdmin({ searchParams }: { searchParams: Promise<{ q?: string; review?: string }> }) {
  await requirePageRole("COUNSELOR", "ADMIN");
  const { q = "", review } = await searchParams;
  const needle = q.slice(0, 100);

  const [courses, provisional, waiting] = await Promise.all([
    db.course.findMany({
      where: {
        ...(needle ? { OR: [{ name: { contains: needle, mode: "insensitive" } }, { slug: { contains: needle, mode: "insensitive" } }] } : {}),
        ...(review ? { requirements: { some: { provisional: true } } } : {}),
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: { requirements: { select: { kind: true, credits: true, provisional: true } } },
    }),
    db.courseRequirement.count({ where: { provisional: true } }),
    db.importRequest.count({ where: { status: "PENDING" } }),
  ]);

  // Already sorted by department, so grouping keeps the catalog order (Other Programs last).
  const groups = [...Map.groupBy(courses, (c) => c.department)];
  const filtered = Boolean(needle || review);
  const openAll = filtered || courses.length <= OPEN_ALL_UP_TO || groups.length === 1;
  const reviewHref = (on: boolean) => {
    const p = new URLSearchParams();
    if (needle) p.set("q", needle);
    if (on) p.set("review", "1");
    return p.size ? `/admin/catalog?${p}` : "/admin/catalog";
  };

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Add, edit and archive courses. Move a course that fits no subject to Other Programs. Every change is audited."
        actions={
          <>
            <Link className="btn btn-sm" href="/admin/catalog/requests">Import requests{waiting > 0 ? ` (${waiting})` : ""}</Link>
            <a className="btn btn-sm" href="/admin/catalog/export" download>Export CSV</a>
            <Link className="btn btn-sm btn-primary" href="/admin/catalog/new">New course</Link>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-12">
        <aside className="space-y-6 self-start lg:sticky lg:top-24">
          <form action="/admin/catalog" aria-label="Search the catalog" className="grid gap-2">
            {review && <input type="hidden" name="review" value="1" />}
            <input className="input" name="q" defaultValue={q} placeholder="Search name or slug" aria-label="Search" />
            <div className="flex gap-2">
              <button className="btn flex-1" type="submit">Search</button>
              {filtered && <Link className="btn btn-ghost" href="/admin/catalog">Clear</Link>}
            </div>
          </form>

          <div className="soft space-y-3 p-4">
            <p className="text-[14px] leading-relaxed">
              <span className="num font-semibold">{provisional}</span>{" "}
              <span className="text-muted">requirement {provisional === 1 ? "tag needs" : "tags need"} counselor review. They count toward graduation but show as unconfirmed.</span>
            </p>
            <Link className="btn btn-sm w-full" href={reviewHref(!review)}>
              {review ? "Show all courses" : "Only needing review"}
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <p className="text-[14px] text-muted lg:pt-2.5">
            <span className="num">{courses.length}</span> {courses.length === 1 ? "course" : "courses"}
            {review && " needing review"}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {groups.map(([dept, rows]) => {
              const needReview = rows.filter((c) => c.requirements.some((r) => r.provisional)).length;
              return (
                <Fold
                  key={dept}
                  title={DEPT_LABEL[dept]}
                  count={rows.length}
                  open={openAll}
                  note={needReview > 0 && !review ? <Badge tone="warning">{needReview} to review</Badge> : undefined}
                >
                  <ul className="list list-hover">
                    {rows.map((c) => {
                      const tags = c.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional }));
                      const prov = c.requirements.some((r) => r.provisional);
                      return (
                        <li key={c.id} className="group/row flex items-center gap-2">
                          <Link href={`/admin/catalog/${c.id}`} className={cn("flex min-w-0 flex-1 items-center gap-3 py-2.5", `subject-${rowFor(tags)}`)}>
                            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full bg-[var(--tile-ink)]", c.archived && "opacity-40")} />
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-[15px] font-medium", c.archived && "text-muted")}>{c.name}</span>
                              <span className="mt-0.5 block text-[13px] text-muted">
                                {LEVEL_LABEL[c.level]}, grades <span className="num">{c.gradesOffered.join(", ")}</span>
                              </span>
                            </span>
                            {c.archived && <Badge tone="locked">Archived</Badge>}
                            {prov && <Badge tone="warning">Needs review</Badge>}
                            <span className="num w-12 shrink-0 text-right text-[14px] text-muted">{fmtCredits(c.credits)} cr</span>
                          </Link>
                          {/* Same slot on every row, empty for Other Programs, so credits line up across groups.
                              Phones skip it for room; the edit page's Department field does the same move. */}
                          <span className="hidden min-w-32 shrink-0 justify-end sm:flex transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">
                            {c.department !== "OTHER" && <MoveToOther courseId={c.id} courseName={c.name} />}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Fold>
              );
            })}
          </div>
          {courses.length === 0 && (
            <EmptyState
              title="No courses match"
              description={review ? "Nothing here needs review." : "Try another name or slug."}
              action={<Link className="btn btn-sm" href="/admin/catalog">Clear</Link>}
            />
          )}
        </div>
      </div>

      <Section className="mt-16"><CsvImport /></Section>
    </div>
  );
}
