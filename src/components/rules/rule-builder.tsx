"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { GRADES, gradeText, type LeafRule, type Rule } from "@/lib/eligibility";
import { saveCourseRules } from "@/lib/rules/actions";
import { describeRule } from "@/lib/rules/describe";
import { addChild, asGroup, blankGroup, blankLeaf, moveAt, problems, removeAt, setGroupType, tidy, updateAt, type LeafType, type Path } from "@/lib/rules/tree";

interface CourseOption {
  slug: string;
  name: string;
}

const LEAF_LABEL: Record<LeafType, string> = {
  completed: "Completed a course",
  minGrade: "Minimum grade in a course",
  coreq: "Taken in the same year",
  gradeLevel: "Grade level",
  priorCoursework: "8th grade math",
  manual: "Checked by a person",
};

const isGroup = (r: Rule): r is Extract<Rule, { rules: Rule[] }> => r.type === "all" || r.type === "any";

function CoursePicker({ value, options, onChange }: { value: string[]; options: CourseOption[]; onChange: (v: string[]) => void }) {
  const listId = useId();
  const [text, setText] = useState("");
  const byName = useMemo(() => new Map(options.map((o) => [o.name.toLowerCase(), o.slug])), [options]);
  const nameOf = (slug: string) => options.find((o) => o.slug === slug)?.name ?? slug;

  function take(v: string) {
    setText(v);
    const slug = byName.get(v.trim().toLowerCase());
    if (slug && !value.includes(slug)) {
      onChange([...value, slug]);
      setText("");
    }
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <li key={s} className="flex items-center gap-1 rounded-md border border-line-strong px-2 py-0.5 text-xs">
              {nameOf(s)}
              <button type="button" aria-label={`Remove ${nameOf(s)}`} className="text-muted hover:text-fg" onClick={() => onChange(value.filter((x) => x !== s))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input className="input" list={listId} value={text} placeholder="Type a course name" aria-label="Add a course" onChange={(e) => take(e.target.value)} />
      <datalist id={listId}>
        {options.map((o) => <option key={o.slug} value={o.name} />)}
      </datalist>
    </div>
  );
}

function Common({ rule, onChange }: { rule: LeafRule; onChange: (r: LeafRule) => void }) {
  const set = (patch: Partial<LeafRule>) => onChange({ ...rule, ...patch } as LeafRule);
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
      <label className="flex items-center gap-2 text-[13px] text-muted">
        <input type="checkbox" checked={!!rule.advisory} onChange={(e) => set({ advisory: e.target.checked || undefined })} />
        Only suggested
      </label>
      <label className="flex items-center gap-2 text-[13px] text-muted">
        Appeal
        <select
          className="input !h-8 !w-auto"
          value={rule.appealable === undefined ? "" : String(rule.appealable)}
          onChange={(e) => set({ appealable: e.target.value === "" ? undefined : e.target.value === "true" })}
          aria-label="Can the student appeal"
        >
          <option value="">Automatic</option>
          <option value="true">Can appeal</option>
          <option value="false">Locked</option>
        </select>
      </label>
      <input className="input" placeholder="Note for students (optional)" aria-label="Note" maxLength={300} value={rule.note ?? ""} onChange={(e) => set({ note: e.target.value || undefined })} />
    </div>
  );
}

function LeafFields({ rule, options, onChange }: { rule: LeafRule; options: CourseOption[]; onChange: (r: LeafRule) => void }) {
  switch (rule.type) {
    case "completed":
    case "coreq":
      return <CoursePicker value={rule.courses} options={options} onChange={(courses) => onChange({ ...rule, courses })} />;
    case "minGrade":
      return (
        <div className="space-y-2">
          <CoursePicker value={rule.courses} options={options} onChange={(courses) => onChange({ ...rule, courses })} />
          <div className="flex flex-wrap gap-2">
            <select className="input !w-auto" aria-label="Minimum grade" value={rule.grade} onChange={(e) => onChange({ ...rule, grade: e.target.value as typeof rule.grade })}>
              {[...GRADES].reverse().map((g) => <option key={g} value={g}>{gradeText(g)} or higher</option>)}
            </select>
            <select className="input !w-auto" aria-label="Grade basis" value={rule.basis} onChange={(e) => onChange({ ...rule, basis: e.target.value as typeof rule.basis })}>
              <option value="initialAverage">Initial test/quiz average (estimated from the final grade)</option>
              <option value="final">Final grade</option>
            </select>
          </div>
        </div>
      );
    case "gradeLevel":
      return (
        <div className="flex gap-4">
          {[9, 10, 11, 12].map((g) => (
            <label key={g} className="flex items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                checked={rule.in.includes(g)}
                onChange={(e) => onChange({ ...rule, in: e.target.checked ? [...rule.in, g].sort() : rule.in.filter((x) => x !== g) })}
              />
              Grade {g}
            </label>
          ))}
        </div>
      );
    case "priorCoursework":
      return (
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto" aria-label="8th grade course" value={rule.value ?? ""} onChange={(e) => onChange({ ...rule, value: (e.target.value || undefined) as typeof rule.value })}>
            <option value="">Any 8th grade math</option>
            <option value="ALGEBRA_I">Algebra I</option>
            <option value="PRE_ALGEBRA">Pre-Algebra</option>
          </select>
          <select className="input !w-auto" aria-label="Minimum grade" value={rule.minGrade ?? ""} onChange={(e) => onChange({ ...rule, minGrade: (e.target.value || undefined) as typeof rule.minGrade })}>
            <option value="">Any grade</option>
            {[...GRADES].reverse().map((g) => <option key={g} value={g}>{gradeText(g)} or higher</option>)}
          </select>
        </div>
      );
    case "manual":
      return <input className="input" aria-label="What a person checks" placeholder="For example: Placement exam proficiency" maxLength={200} value={rule.label} onChange={(e) => onChange({ ...rule, label: e.target.value })} />;
  }
}

function Controls({ path, root, setRoot }: { path: Path; root: Rule; setRoot: (r: Rule) => void }) {
  return (
    <span className="flex shrink-0 gap-1">
      <Button size="sm" variant="ghost" aria-label="Move up" onClick={() => setRoot(moveAt(root, path, -1))}>↑</Button>
      <Button size="sm" variant="ghost" aria-label="Move down" onClick={() => setRoot(moveAt(root, path, 1))}>↓</Button>
      <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => setRoot(removeAt(root, path))}>Remove</Button>
    </span>
  );
}

function Node({ rule, path, root, setRoot, options }: { rule: Rule; path: Path; root: Rule; setRoot: (r: Rule) => void; options: CourseOption[] }) {
  const isRoot = path.length === 0;
  if (isGroup(rule)) {
    return (
      <div className={isRoot ? "space-y-3" : "space-y-3 border-l border-line-strong pl-4"}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select className="input !w-auto" aria-label="How the group is met" value={rule.type} onChange={(e) => setRoot(setGroupType(root, path, e.target.value as "all" | "any"))}>
            <option value="all">Needs all of these</option>
            <option value="any">Needs any one of these</option>
          </select>
          {!isRoot && <Controls path={path} root={root} setRoot={setRoot} />}
        </div>
        <ul className="space-y-3">
          {rule.rules.map((c, i) => (
            <li key={i}>
              <Node rule={c} path={[...path, i]} root={root} setRoot={setRoot} options={options} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <select
            className="input !w-auto"
            aria-label="Add a requirement"
            value=""
            onChange={(e) => e.target.value && setRoot(addChild(root, path, blankLeaf(e.target.value as LeafType)))}
          >
            <option value="">Add a requirement…</option>
            {(Object.keys(LEAF_LABEL) as LeafType[]).map((t) => <option key={t} value={t}>{LEAF_LABEL[t]}</option>)}
          </select>
          <Button size="sm" onClick={() => setRoot(addChild(root, path, blankGroup("any")))}>Add a group</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2.5 rounded-md border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium">{LEAF_LABEL[rule.type]}</h3>
        <Controls path={path} root={root} setRoot={setRoot} />
      </div>
      <LeafFields rule={rule} options={options} onChange={(r) => setRoot(updateAt(root, path, () => r))} />
      {rule.type !== "manual" && <Common rule={rule} onChange={(r) => setRoot(updateAt(root, path, () => r))} />}
      {rule.type === "manual" && (
        <input className="input" placeholder="Note for students (optional)" aria-label="Note" maxLength={300} value={rule.note ?? ""} onChange={(e) => setRoot(updateAt(root, path, () => ({ ...rule, note: e.target.value || undefined })))} />
      )}
    </div>
  );
}

export function RuleBuilder({ courseId, initial, options }: { courseId: string; initial: Rule | null; options: CourseOption[] }) {
  const [root, setRoot, draft] = useDraftState<Rule>(`rules:${courseId}`, asGroup(initial));
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const clean = useMemo(() => tidy(root), [root]);
  const issues = useMemo(() => problems(clean), [clean]);
  const names = useMemo(() => Object.fromEntries(options.map((o) => [o.slug, o.name])), [options]);

  function save() {
    setError(null);
    setSaved(null);
    start(async () => {
      try {
        const r = await saveCourseRules({ courseId, rules: clean });
        if (r.ok) { draft.commit(root); setSaved(clean ? "Saved." : "Rules cleared. The catalog text is now only a note."); }
        else setError(r.error);
      } catch { setError(SAVE_INTERRUPTED); }
    });
  }

  return (
    <div className="space-y-8">
      <DraftNotice drafts={[draft]} />
      <Node rule={root} path={[]} root={root} setRoot={(r) => { setRoot(r); setSaved(null); }} options={options} />

      <div>
        <h2 className="mb-1 text-sm font-medium">Reads as</h2>
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-muted" aria-live="polite">
          {clean ? describeRule(clean, names) : "No rule. Students see the catalog text as a note and are not checked automatically."}
        </p>
      </div>

      {issues.length > 0 && (
        <ul role="alert" className="space-y-1 text-[13px] text-red">
          {issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}
      {saved && <p role="status" className="text-[13px] text-green">{saved}</p>}

      <div className="flex gap-2">
        <Button variant="primary" disabled={pending || issues.length > 0} onClick={save}>{pending ? "Saving" : "Save rules"}</Button>
        <Button variant="ghost" disabled={pending} onClick={() => { draft.discard(); setSaved(null); setError(null); }}>Reset</Button>
      </div>
    </div>
  );
}
