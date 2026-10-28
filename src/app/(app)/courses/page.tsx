export const instant = false;

import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { buildCourseWhere } from "@/lib/catalog/queries";
import { DEPT_LABEL, KIND_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
import { LEVELS, courseFilterSchema } from "@/lib/catalog/schemas";

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function Courses({ searchParams }: { searchParams: Params }) {
  await requirePageUser();
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const parsed = courseFilterSchema.safeParse({
    q: pick("q"), department: pick("department"), level: pick("level"), duration: pick("duration"),
    grade: pick("grade"), interest: pick("interest"),
  });
  const filter = parsed.success ? parsed.data : {};

  const [courses, interests] = await Promise.all([
    db.course.findMany({
      where: buildCourseWhere(filter),
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: { requirements: { select: { kind: true, provisional: true } } },
      take: 400,
    }),
    db.interestTag.findMany({ orderBy: { label: "asc" } }),
  ]);

  const sel = "input !w-auto max-w-[11rem]";
  return (
    <div>
      <PageHeader title="Courses" description="From the 2026-2027 Program of Studies. Not every course runs every year." />

      <form className="flex flex-wrap items-center gap-2" action="/courses">
        <input className="input !w-64" name="q" defaultValue={filter.q} placeholder="Search courses" aria-label="Search" />
        <select className={sel} name="department" defaultValue={filter.department ?? ""} aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
        </select>
        <select className={sel} name="level" defaultValue={filter.level ?? ""} aria-label="Level">
          <option value="">All levels</option>
          {LEVELS.filter((l) => l !== "MIDDLE_SCHOOL").map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <select className={sel} name="grade" defaultValue={filter.grade ?? ""} aria-label="Grade">
          <option value="">Any grade</option>
          {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select className={sel} name="duration" defaultValue={filter.duration ?? ""} aria-label="Length">
          <option value="">Any length</option>
          <option value="FULL">Full year</option>
          <option value="HALF">Half year</option>
        </select>
        <select className={sel} name="interest" defaultValue={filter.interest ?? ""} aria-label="Interest">
          <option value="">Any interest</option>
          {interests.map((i) => <option key={i.id} value={i.slug}>{i.label}</option>)}
        </select>
        <button className="btn btn-sm btn-primary" type="submit">Filter</button>
        <Link className="btn btn-sm btn-ghost" href="/courses">Reset</Link>
      </form>

      <p className="num mb-3 mt-8 text-muted">{courses.length} courses</p>
      <ul className="list list-hover">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={`/courses/${c.slug}`} className="flex items-baseline justify-between gap-6 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="mt-0.5 block text-[13px] text-muted">
                  {DEPT_LABEL[c.department]} · {LEVEL_LABEL[c.level]}
                  {(() => {
                    // Only say it when it adds information (Theater Arts counts toward Arts, not English).
                    const kinds = [...new Set(c.requirements.map((r) => KIND_LABEL[r.kind]))].filter((k) => k !== DEPT_LABEL[c.department]);
                    return kinds.length > 0 ? <> · counts toward {kinds.join(", ")}</> : null;
                  })()}
                </span>
              </span>
              <span className="num shrink-0 text-right text-muted">
                <span className="block text-fg">{fmtCredits(c.credits)} cr</span>
                <span className="block">grade {c.gradesOffered.join(" ")}</span>
              </span>
            </Link>
          </li>
        ))}
        </ul>
      {courses.length === 0 && (
        <EmptyState
          title="No courses match those filters"
          description="Try a different department or level, or clear the search."
          action={<Link className="btn btn-sm" href="/courses">Clear filters</Link>}
        />
      )}
    </div>
  );
}
