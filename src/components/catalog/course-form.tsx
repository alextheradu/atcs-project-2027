"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { createCourse, deleteCourse, setCourseArchived, updateCourse } from "@/lib/catalog/admin";
import { DEPT_LABEL, KIND_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { LEVELS, REQUIREMENT_KINDS, type CourseInput } from "@/lib/catalog/schemas";

interface Props {
  mode: "new" | "edit";
  courseId?: string;
  archived?: boolean;
  initial: CourseInput;
  interestOptions: { slug: string; label: string }[];
}

const field = "space-y-1.5";
const label = "text-[13px] font-medium";

export function CourseForm({ mode, courseId, archived, initial, interestOptions }: Props) {
  const router = useRouter();
  const [c, setC] = useState<CourseInput>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CourseInput>(k: K, v: CourseInput[K]) => setC((p) => ({ ...p, [k]: v }));

  const tag = (kind: (typeof REQUIREMENT_KINDS)[number]) => c.requirements.find((r) => r.kind === kind);
  const setTag = (kind: (typeof REQUIREMENT_KINDS)[number], next: { credits: number; provisional: boolean } | null) =>
    set("requirements", [
      ...c.requirements.filter((r) => r.kind !== kind),
      ...(next ? [{ kind, ...next }] : []),
    ]);

  const save = () =>
    start(async () => {
      if (mode === "new") {
        const r = await createCourse(c);
        if (r.ok && r.data) router.push(`/admin/catalog/${r.data.id}`);
        else setMsg({ ok: false, text: r.ok ? "Saved" : r.error });
      } else {
        const r = await updateCourse(courseId!, c);
        setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error });
        if (r.ok) router.refresh();
      }
    });

  return (
    <div className="space-y-10">
      <section className="grid gap-5 sm:grid-cols-2">
        <label className={field}>
          <span className={label}>Name</span>
          <input className="input" value={c.name} onChange={(e) => set("name", e.target.value)} maxLength={160} />
        </label>
        <label className={field}>
          <span className={label}>Slug {mode === "edit" && "(fixed)"}</span>
          <input className="input font-mono" value={c.slug} disabled={mode === "edit"} onChange={(e) => set("slug", e.target.value)} />
        </label>
        <label className={field}>
          <span className={label}>Department</span>
          <select className="input" value={c.department} onChange={(e) => set("department", e.target.value as never)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
          </select>
        </label>
        <label className={field}>
          <span className={label}>Level</span>
          <select className="input" value={c.level} onChange={(e) => set("level", e.target.value as never)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>
        <label className={field}>
          <span className={label}>Length</span>
          <select
            className="input"
            value={c.duration}
            onChange={(e) => {
              const d = e.target.value as "FULL" | "HALF";
              setC((p) => ({ ...p, duration: d, credits: d === "HALF" ? 2.5 : p.credits === 2.5 ? 5 : p.credits }));
            }}
          >
            <option value="FULL">Full year</option>
            <option value="HALF">Half year</option>
          </select>
        </label>
        <label className={field}>
          <span className={label}>Credits</span>
          <input className="input font-mono" type="number" step="0.5" min={0} max={30} value={c.credits} onChange={(e) => set("credits", Number(e.target.value))} />
        </label>
        <fieldset className={field}>
          <legend className={label}>Grades offered</legend>
          <div className="flex gap-4">
            {[8, 9, 10, 11, 12].map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--accent)]"
                  checked={c.gradesOffered.includes(g)}
                  onChange={(e) => set("gradesOffered", e.target.checked ? [...c.gradesOffered, g].sort() : c.gradesOffered.filter((x) => x !== g))}
                />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={field}>
          <span className={label}>PDF page</span>
          <input className="input font-mono" type="number" min={1} value={c.sourcePage ?? ""} onChange={(e) => set("sourcePage", e.target.value === "" ? null : Number(e.target.value))} />
        </label>
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={c.plannable} onChange={(e) => set("plannable", e.target.checked)} />Plannable</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={c.hasApExam} onChange={(e) => set("hasApExam", e.target.checked)} />Has an AP exam</label>
        </div>
        <label className={`${field} sm:col-span-2`}>
          <span className={label}>Description</span>
          <textarea className="input !h-28 py-2" value={c.description} maxLength={4000} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className={`${field} sm:col-span-2`}>
          <span className={label}>Prerequisite text (verbatim from the PDF)</span>
          <textarea className="input !h-20 py-2" value={c.prereqText ?? ""} maxLength={2000} onChange={(e) => set("prereqText", e.target.value || null)} />
        </label>
        <label className={`${field} sm:col-span-2`}>
          <span className={label}>Dual enrollment note</span>
          <input className="input" value={c.dualEnrollmentNote ?? ""} maxLength={500} onChange={(e) => set("dualEnrollmentNote", e.target.value || null)} />
        </label>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <h2 className="text-sm font-medium">Graduation requirement tags</h2>
        <ul className="list">
          {REQUIREMENT_KINDS.map((kind) => {
            const t = tag(kind);
            return (
              <li key={kind} className="flex flex-wrap items-center gap-4 py-2.5 text-sm">
                <label className="flex w-64 items-center gap-2">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={!!t} onChange={(e) => setTag(kind, e.target.checked ? { credits: c.credits, provisional: false } : null)} />
                  {KIND_LABEL[kind]}
                </label>
                {t && (
                  <>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Credits
                      <input className="input !h-8 !w-20 font-mono" type="number" step="0.5" min={0} max={30} value={t.credits} onChange={(e) => setTag(kind, { ...t, credits: Number(e.target.value) })} />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" className="accent-[var(--accent)]" checked={t.provisional} onChange={(e) => setTag(kind, { ...t, provisional: e.target.checked })} />
                      Needs counselor review
                    </label>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <h2 className="text-sm font-medium">Interest tags</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2.5">
          {interestOptions.map((i) => (
            <label key={i.slug} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={c.interests.includes(i.slug)} onChange={(e) => set("interests", e.target.checked ? [...c.interests, i.slug] : c.interests.filter((x) => x !== i.slug))} />
              {i.label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button variant="primary" onClick={save} disabled={pending}>{mode === "new" ? "Create course" : "Save changes"}</Button>
        {mode === "edit" && courseId && (
          <>
            <Button disabled={pending} onClick={() => start(async () => { await setCourseArchived(courseId, !archived); router.refresh(); })}>
              {archived ? "Restore" : "Archive"}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!confirm("Delete this course permanently? This only works if nothing uses it.")) return;
                start(async () => {
                  const r = await deleteCourse(courseId);
                  if (r.ok) router.push("/admin/catalog");
                  else setMsg({ ok: false, text: r.error });
                });
              }}
            >
              Delete
            </Button>
          </>
        )}
        {msg && <span role="status" className={msg.ok ? "text-sm text-green" : "text-sm text-red"}>{msg.text}</span>}
      </div>
    </div>
  );
}
