export const instant = false;

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { buildCourseWhere } from "@/lib/catalog/queries";
import { DEPT_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="mt-1 text-muted">From the 2026-2027 Program of Studies. Not every course runs every year.</p>
      </header>

      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" action="/courses">
        <input className="input lg:col-span-2" name="q" defaultValue={filter.q} placeholder="Search courses" aria-label="Search" />
        <select className="input" name="department" defaultValue={filter.department ?? ""} aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
        </select>
        <select className="input" name="level" defaultValue={filter.level ?? ""} aria-label="Level">
          <option value="">All levels</option>
          {LEVELS.filter((l) => l !== "MIDDLE_SCHOOL").map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
        </select>
        <select className="input" name="grade" defaultValue={filter.grade ?? ""} aria-label="Grade">
          <option value="">Any grade</option>
          {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <select className="input" name="duration" defaultValue={filter.duration ?? ""} aria-label="Length">
          <option value="">Any length</option>
          <option value="FULL">Full year</option>
          <option value="HALF">Half year</option>
        </select>
        <select className="input lg:col-span-2" name="interest" defaultValue={filter.interest ?? ""} aria-label="Interest">
          <option value="">Any interest</option>
          {interests.map((i) => <option key={i.id} value={i.slug}>{i.label}</option>)}
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <button className="btn btn-primary" type="submit">Filter</button>
          <Link className="btn btn-ghost" href="/courses">Reset</Link>
        </div>
      </form>

      <p className="font-mono text-xs text-muted">{courses.length} courses</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {courses.map((c) => (
          <li key={c.id}>
            <Link href={`/courses/${c.slug}`} className="card block p-4 transition-colors hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{c.name}</div>
                <span className="shrink-0 font-mono text-xs text-muted">{fmtCredits(c.credits)} cr</span>
              </div>
              <div className="mt-1 text-xs text-muted">
                {DEPT_LABEL[c.department]} · {LEVEL_LABEL[c.level]} · Grade {c.gradesOffered.join(", ")}
              </div>
              {c.requirements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.requirements.map((r) => (
                    <Badge key={r.kind}>{r.kind.replace("_", " ").toLowerCase()}{r.provisional ? " (unconfirmed)" : ""}</Badge>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
