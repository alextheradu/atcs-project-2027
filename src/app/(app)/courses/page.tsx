export const instant = false;

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { PathwaysView } from "@/components/pathways/pathways-view";
import { EmptyState } from "@/components/ui/empty-state";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { requirePageUser } from "@/lib/auth/page";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { rowFor } from "@/lib/board";
import { db } from "@/lib/db";
import { buildCourseWhere } from "@/lib/catalog/queries";
import { DEPT_LABEL, KIND_LABEL, LEVEL_LABEL, fmtCredits } from "@/lib/catalog/labels";
import { LEVELS, courseFilterSchema } from "@/lib/catalog/schemas";
import type { RequirementKind } from "@/lib/requirements";
import { cn } from "@/lib/utils";

type Params = Promise<Record<string, string | string[] | undefined>>;

// Results at or under this many classes open every subject.
const OPEN_ALL_UP_TO = 20;

function ViewTabs({ view }: { view: "list" | "pathways" }) {
  const tab = (v: "list" | "pathways", label: string) => (
    <Link
      href={v === "list" ? "/courses" : "/courses?view=pathways"}
      aria-current={view === v ? "page" : undefined}
      className={cn("flex h-9 items-center rounded-full px-4 text-[14px] transition-colors", view === v ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg")}
    >
      {label}
    </Link>
  );
  return <nav aria-label="Classes view" className="mb-6 flex gap-1">{tab("list", "List")}{tab("pathways", "Pathways")}</nav>;
}

export default async function Courses({ searchParams }: { searchParams: Params }) {
  const user = await requirePageUser();
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" && raw[k] !== "" ? (raw[k] as string) : undefined);
  const view = pick("view") === "pathways" ? "pathways" : "list";

  const header = (
    <header className="mb-4">
      <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-0.025em]">Classes</h1>
      <p className="mt-1 text-[15px] text-muted">Every class in the 2026-2027 Program of Studies. Not every class runs every year.</p>
    </header>
  );

  if (view === "pathways") {
    return (
      <div>
        {header}
        <ViewTabs view="pathways" />
        <PathwaysView
          userId={user.id}
          student={canUseStudentWorkspace(user.role)}
          query={{ subject: pick("subject"), start: pick("start"), lang: pick("lang") }}
        />
      </div>
    );
  }

  const parsed = courseFilterSchema.safeParse({
    q: pick("q"), department: pick("department"), level: pick("level"), duration: pick("duration"),
    grade: pick("grade"), interest: pick("interest"),
  });
  const filter = parsed.success ? parsed.data : {};
  const filtered = Object.values(filter).some((v) => v !== undefined && v !== "");

  const [courses, interests] = await Promise.all([
    db.course.findMany({
      where: buildCourseWhere(filter),
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: { requirements: { select: { kind: true, credits: true, provisional: true } } },
      take: 400,
    }),
    db.interestTag.findMany({ orderBy: { label: "asc" } }),
  ]);

  // Already sorted by department, so grouping keeps the catalog order.
  const groups = [...Map.groupBy(courses, (c) => c.department)];
  // A short result (about a screen and a half of rows) or a single subject shows everything. Anything longer,
  // including the whole catalog or a broad filter like "9th grade", starts with every subject closed.
  const openAll = courses.length <= OPEN_ALL_UP_TO || groups.length === 1;
  const sel = "input !w-auto max-w-[12rem]";
  return (
    <div className="max-w-[960px]">
      {header}
      <ViewTabs view="list" />

      <form className="flex flex-wrap items-center gap-2" action="/courses">
        <input className="input !w-full sm:!w-72" name="q" defaultValue={filter.q} placeholder="Search classes" aria-label="Search" />
        <select className={sel} name="department" defaultValue={filter.department ?? ""} aria-label="Subject">
          <option value="">Any subject</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
        </select>
        <select className={sel} name="grade" defaultValue={filter.grade ?? ""} aria-label="Grade">
          <option value="">Any grade</option>
          {[9, 10, 11, 12].map((g) => <option key={g} value={g}>{g}th grade</option>)}
        </select>
        <select className={sel} name="level" defaultValue={filter.level ?? ""} aria-label="Level">
          <option value="">Any level</option>
          {LEVELS.filter((l) => l !== "MIDDLE_SCHOOL").map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
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
        <button className="btn" type="submit">Search</button>
        {filtered && <Link className="btn btn-ghost" href="/courses">Clear</Link>}
      </form>

      <p className="mt-6 text-[14px] text-muted"><span className="num">{courses.length}</span> {courses.length === 1 ? "class" : "classes"}</p>
      <div className="mt-3 flex flex-col gap-1">
        {groups.map(([dept, rows]) => (
          <details key={dept} open={openAll} className="group">
            <summary className="-mx-3 flex cursor-pointer list-none items-center gap-3 rounded-[10px] px-3 py-3 transition-colors hover:bg-fill [&::-webkit-details-marker]:hidden">
              <h2 className="eyebrow flex-1">{DEPT_LABEL[dept]}</h2>
              <span className="num text-[14px] text-muted">{rows.length}</span>
              <ChevronDown size={16} aria-hidden className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-180" />
            </summary>
            <ul className="list list-hover pb-4">
              {rows.map((c) => {
                const tags = c.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional }));
                // Only say it when it adds information (Theater Arts counts toward Arts, not English).
                const kinds = [...new Set(c.requirements.map((r) => KIND_LABEL[r.kind]))].filter((k) => k !== DEPT_LABEL[c.department]);
                return (
                  <li key={c.id}>
                    <Link href={`/courses/${c.slug}`} className={cn("flex items-center gap-3 py-2.5", `subject-${rowFor(tags)}`)}>
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--tile-ink)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{c.name}</span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {LEVEL_LABEL[c.level]}, grades <span className="num">{c.gradesOffered.join(", ")}</span>
                          {kinds.length > 0 ? <>, counts toward {kinds.join(", ")}</> : tags.length === 0 ? <>, counts as an elective</> : null}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[14px] text-muted">{fmtCredits(c.credits)} cr</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
      {courses.length === 0 && (
        <EmptyState
          title="No classes match"
          description="Try another subject or level, or clear the search."
          action={<Link className="btn btn-sm" href="/courses">Clear</Link>}
        />
      )}
    </div>
  );
}
