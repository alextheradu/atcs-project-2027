/** Immutable edits for the rule builder. A path is the list of child indexes from the root. Pure. */
import type { LeafRule, Rule } from "@/lib/eligibility";

export type Path = number[];

export type LeafType = LeafRule["type"];

export function blankLeaf(type: LeafType): LeafRule {
  switch (type) {
    case "completed":
      return { type, courses: [] };
    case "minGrade":
      return { type, courses: [], grade: "B", basis: "initialAverage" };
    case "gradeLevel":
      return { type, in: [10, 11, 12] };
    case "coreq":
      return { type, courses: [] };
    case "priorCoursework":
      return { type, field: "eighthMath" };
    case "manual":
      return { type, label: "" };
  }
}

export const blankGroup = (type: "all" | "any"): Rule => ({ type, rules: [] });

const isGroup = (r: Rule): r is Extract<Rule, { rules: Rule[] }> => r.type === "all" || r.type === "any";

export function getAt(root: Rule, path: Path): Rule | null {
  let cur: Rule = root;
  for (const i of path) {
    if (!isGroup(cur) || !cur.rules[i]) return null;
    cur = cur.rules[i];
  }
  return cur;
}

/** Returns a new tree with `fn` applied to the node at `path`. An unknown path returns the tree unchanged. */
export function updateAt(root: Rule, path: Path, fn: (r: Rule) => Rule): Rule {
  if (path.length === 0) return fn(root);
  if (!isGroup(root)) return root;
  const [head, ...rest] = path;
  if (!root.rules[head]) return root;
  return { ...root, rules: root.rules.map((c, i) => (i === head ? updateAt(c, rest, fn) : c)) };
}

export function addChild(root: Rule, path: Path, child: Rule): Rule {
  return updateAt(root, path, (r) => (isGroup(r) ? { ...r, rules: [...r.rules, child] } : r));
}

/** Removes the node. The root cannot be removed. */
export function removeAt(root: Rule, path: Path): Rule {
  if (path.length === 0) return root;
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return updateAt(root, parent, (r) => (isGroup(r) ? { ...r, rules: r.rules.filter((_, i) => i !== idx) } : r));
}

export function moveAt(root: Rule, path: Path, delta: -1 | 1): Rule {
  if (path.length === 0) return root;
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return updateAt(root, parent, (r) => {
    if (!isGroup(r)) return r;
    const to = idx + delta;
    if (to < 0 || to >= r.rules.length) return r;
    const next = [...r.rules];
    [next[idx], next[to]] = [next[to], next[idx]];
    return { ...r, rules: next };
  });
}

/** Switch a group between All and Any, keeping its children. */
export function setGroupType(root: Rule, path: Path, type: "all" | "any"): Rule {
  return updateAt(root, path, (r) => (isGroup(r) ? { ...r, type } : r));
}

/** Wrap a rule so it can be extended: a lone leaf becomes an All group holding it. */
export function asGroup(rule: Rule | null): Rule {
  if (!rule) return blankGroup("all");
  return isGroup(rule) ? rule : { type: "all", rules: [rule] };
}

/** Drop empty groups and single-child groups, the way the PDF reads. A group of one is just the child. */
export function tidy(rule: Rule): Rule | null {
  if (!isGroup(rule)) return rule;
  const kids = rule.rules.map(tidy).filter((r): r is Rule => r !== null);
  if (kids.length === 0) return null;
  if (kids.length === 1) return kids[0];
  return { ...rule, rules: kids };
}

/** Problems that stop a rule from being saved, in plain words. Empty when it is fine. */
export function problems(rule: Rule | null): string[] {
  if (!rule) return [];
  const out: string[] = [];
  const visit = (r: Rule) => {
    if (isGroup(r)) return r.rules.forEach(visit);
    if ((r.type === "completed" || r.type === "minGrade" || r.type === "coreq") && r.courses.length === 0) out.push("Pick at least one course for each course requirement.");
    if (r.type === "manual" && !r.label.trim()) out.push("Give each manual requirement a label.");
    if (r.type === "gradeLevel" && r.in.length === 0) out.push("Pick at least one grade for each grade requirement.");
  };
  visit(rule);
  return [...new Set(out)];
}
