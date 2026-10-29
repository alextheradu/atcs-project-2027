"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bulkAddCourses, confirmImport, type ImportSummary } from "@/lib/transcript/actions";
import { letterToEnum } from "@/lib/transcript/grades";
import { createMatcher, matchKey, type AliasRow, type Band, type CatalogCourse } from "@/lib/transcript/match";
import { parseTranscript, type ParsedTranscript } from "@/lib/transcript/parse";
import { readTranscriptPdf } from "@/lib/transcript/pdf";
import { GRADE_OPTIONS } from "@/lib/plans/view";

interface PlanOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface Props {
  plans: PlanOption[];
  courses: CatalogCourse[];
  aliases: AliasRow[];
}

interface Line {
  key: string;
  title: string;
  gradeLevel: number;
  letter: string | null;
  credits: number | null;
  inProgress: boolean;
  autoCourseId: string | null;
  via: string;
  band: Band;
  candidates: { courseId: string; name: string }[];
  /** What the student chose. "" means skip. */
  courseId: string;
}

const BAND: Record<Band, { label: string; tone: "eligible" | "warning" | "locked" }> = {
  exact: { label: "Matched", tone: "eligible" },
  good: { label: "Likely", tone: "eligible" },
  check: { label: "Check", tone: "warning" },
  none: { label: "No match", tone: "locked" },
};

export function ImportFlow({ plans, courses, aliases }: Props) {
  const [tab, setTab] = useState<"pdf" | "hand">("pdf");
  const [planId, setPlanId] = useState(plans.find((p) => p.isPrimary)?.id ?? plans[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const match = useMemo(() => createMatcher(courses, aliases), [courses, aliases]);
  const sorted = useMemo(() => [...courses].sort((a, b) => a.name.localeCompare(b.name)), [courses]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      // Parsed in this browser tab. The file is never sent anywhere.
      const { items, width } = await readTranscriptPdf(file);
      const t = parseTranscript(items, width);
      const out: Line[] = [];
      for (const b of t.blocks) {
        b.rows.forEach((r, i) => {
          const m = match(r.title);
          const unusable = r.grade !== null && letterToEnum(r.grade) === null;
          out.push({
            key: `${b.gradeLevel}-${i}`, title: r.title, gradeLevel: b.gradeLevel, letter: r.grade, credits: r.credits, inProgress: r.inProgress,
            autoCourseId: m.courseId, via: m.via, band: m.band, candidates: m.candidates.slice(0, 4),
            courseId: unusable ? "" : (m.courseId ?? ""),
          });
        });
      }
      setParsed(t);
      setLines(out);
    } catch (e) {
      setParsed(null);
      setLines([]);
      setError(e instanceof Error ? e.message : "We could not read that file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const chosen = lines.filter((l) => l.courseId && l.courseId !== "__missing");
  const missing = lines.filter((l) => l.courseId === "__missing");

  function confirm() {
    setError(null);
    const rows = chosen.map((l) => ({
      courseId: l.courseId,
      gradeLevel: l.gradeLevel,
      status: l.inProgress ? ("IN_PROGRESS" as const) : ("COMPLETED" as const),
      grade: l.letter ? letterToEnum(l.letter) : null,
      credits: l.inProgress ? null : l.credits,
    }));
    // A hand mapping is any choice that differs from what the matcher picked on its own.
    const suggestions = chosen.filter((l) => l.courseId !== l.autoCourseId || l.via === "fuzzy").map((l) => ({ title: l.title, courseId: l.courseId }));
    start(async () => {
      const r = await confirmImport({ planId, rows, suggestions, missing: missing.map((l) => ({ title: l.title })) });
      if (r.ok) setDone(r.data ?? null);
      else setError(r.error);
    });
  }

  if (plans.length === 0) {
    return <p className="text-sm text-muted">Create a plan first, then come back to import into it. <Link className="underline underline-offset-4" href="/plans">Go to plans</Link></p>;
  }

  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="How to add courses" className="flex gap-5 border-b border-line">
        {([["pdf", "From a transcript"], ["hand", "Add by hand"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b py-2 text-[13px] transition-colors ${tab === k ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      <label className="block max-w-xs space-y-1 text-[13px]">
        <span className="text-muted">Add to plan</span>
        <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isPrimary ? " (primary)" : ""}</option>)}
        </select>
      </label>

      {done && (
        <div role="status" className="border-y border-line py-3 text-[13px]">
          <p>
            Added <span className="num">{done.added}</span> {done.added === 1 ? "course" : "courses"}.
            {done.skipped.length > 0 && <> Skipped {done.skipped.join(", ")} because {done.skipped.length === 1 ? "it was" : "they were"} already in the plan.</>}
            {done.sentToStaff > 0 && <> Sent <span className="num">{done.sentToStaff}</span> {done.sentToStaff === 1 ? "title" : "titles"} to a counselor to review. Courses that are not in the catalog yet were not added. You can add them by hand once they exist.</>}
          </p>
          <Link href={`/plans/${planId}`} className="mt-2 inline-block underline underline-offset-4">Open the plan</Link>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}

      {tab === "pdf" ? (
        <>
          {!parsed && (
            <section className="space-y-3">
              <p className="max-w-[60ch] text-sm text-muted">
                Pick your transcript PDF. It is read inside this browser tab. The file is not uploaded, and your name, ID and birth date are never read or saved. You review every course before anything is added.
              </p>
              <input ref={input} type="file" accept="application/pdf" className="sr-only" id="pdf" onChange={(e) => onFile(e.target.files?.[0])} />
              <label htmlFor="pdf" className="btn btn-primary cursor-pointer">{busy ? "Reading" : "Choose a PDF"}</label>
            </section>
          )}

          {parsed && (
            <section className="space-y-6" aria-label="Review">
              {parsed.classOf && <p className="text-[13px] text-muted">Class of <span className="num text-fg">{parsed.classOf}</span></p>}
              {parsed.warnings.length > 0 && (
                <ul className="space-y-1 border-y border-line py-3 text-[13px] text-yellow" role="status">
                  {parsed.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              {[...new Set(lines.map((l) => l.gradeLevel))].map((g) => (
                <div key={g}>
                  <h2 className="mb-1 text-sm font-medium">Grade {g}</h2>
                  <ul className="list">
                    {lines.filter((l) => l.gradeLevel === g).map((l) => (
                      <li key={l.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] md:items-center md:gap-4">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{l.title}</span>
                          <span className="num block text-xs text-muted">{l.inProgress ? "In progress" : `${l.letter ?? ""} · ${l.credits?.toFixed(1)} cr`}</span>
                        </span>
                        <Badge tone={BAND[l.band].tone}>{BAND[l.band].label}</Badge>
                        <select
                          className="input"
                          aria-label={`Course for ${l.title}`}
                          value={l.courseId}
                          onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, courseId: e.target.value } : x)))}
                        >
                          <option value="">Skip this row</option>
                          <option value="__missing">Not in the catalog, ask a counselor</option>
                          {l.candidates.length > 0 && (
                            <optgroup label="Best matches">
                              {l.candidates.map((c) => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}
                            </optgroup>
                          )}
                          <optgroup label="All courses">
                            {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (retired)" : ""}</option>)}
                          </optgroup>
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" disabled={pending || (chosen.length === 0 && missing.length === 0) || !!done} onClick={confirm}>
                  {pending ? "Adding" : `Add ${chosen.length} ${chosen.length === 1 ? "course" : "courses"}`}
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => { setParsed(null); setLines([]); setDone(null); }}>Start over</Button>
                <span className="text-xs text-muted">Nothing is saved until you add.</span>
              </div>
            </section>
          )}
        </>
      ) : (
        <ByHand planId={planId} courses={sorted} onDone={setDone} onError={setError} />
      )}
    </div>
  );
}

interface HandRow {
  key: number;
  text: string;
  courseId: string;
  gradeLevel: number;
  status: "COMPLETED" | "IN_PROGRESS" | "PLANNED";
  grade: string;
}

function ByHand({ planId, courses, onDone, onError }: { planId: string; courses: CatalogCourse[]; onDone: (s: ImportSummary | null) => void; onError: (e: string | null) => void }) {
  const [rows, setRows] = useState<HandRow[]>([{ key: 1, text: "", courseId: "", gradeLevel: 9, status: "COMPLETED", grade: "" }]);
  const [pending, start] = useTransition();
  const byName = useMemo(() => new Map(courses.map((c) => [matchKey(c.name), c.id])), [courses]);
  const patch = (key: number, p: Partial<HandRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const ready = rows.filter((r) => r.courseId);

  function save() {
    onError(null);
    onDone(null);
    start(async () => {
      const r = await bulkAddCourses({
        planId,
        rows: ready.map((x) => ({ courseId: x.courseId, gradeLevel: x.gradeLevel, status: x.status, grade: x.status === "COMPLETED" && x.grade ? x.grade : null, credits: null })),
      });
      if (r.ok) {
        onDone(r.data ?? null);
        setRows([{ key: Date.now(), text: "", courseId: "", gradeLevel: 9, status: "COMPLETED", grade: "" }]);
      } else onError(r.error);
    });
  }

  return (
    <section className="space-y-4">
      <p className="max-w-[60ch] text-sm text-muted">Search for a course, pick the year and the grade you got. Credits come from the catalog.</p>
      <datalist id="hand-courses">{courses.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="grid gap-2 md:grid-cols-[minmax(0,2fr)_auto_auto_auto] md:items-center">
            <input
              className="input" list="hand-courses" placeholder="Course name" aria-label="Course" value={r.text}
              onChange={(e) => patch(r.key, { text: e.target.value, courseId: byName.get(matchKey(e.target.value)) ?? "" })}
            />
            <select className="input" aria-label="Year" value={r.gradeLevel} onChange={(e) => patch(r.key, { gradeLevel: Number(e.target.value) })}>
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <select className="input" aria-label="Status" value={r.status} onChange={(e) => patch(r.key, { status: e.target.value as HandRow["status"] })}>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="PLANNED">Planned</option>
            </select>
            <select className="input" aria-label="Grade" disabled={r.status !== "COMPLETED"} value={r.grade} onChange={(e) => patch(r.key, { grade: e.target.value })}>
              <option value="">No grade</option>
              {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={() => setRows((rs) => [...rs, { key: Date.now(), text: "", courseId: "", gradeLevel: 9, status: "COMPLETED", grade: "" }])} disabled={rows.length >= 20}>Add a row</Button>
        <Button variant="primary" disabled={pending || ready.length === 0} onClick={save}>{pending ? "Adding" : `Add ${ready.length || ""} ${ready.length === 1 ? "course" : "courses"}`.replace("  ", " ")}</Button>
      </div>
    </section>
  );
}
