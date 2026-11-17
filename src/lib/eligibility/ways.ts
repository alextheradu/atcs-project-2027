/** "Ways to get in": every route through a rule tree that is still open, as steps a student can act on. Pure. */
import type { LeafResult, NodeResult } from "./types";

export interface WayStep {
  /** alongside: take one of `courses` in the same year (or earlier). before: finish one of them first. other: not a class. */
  kind: "alongside" | "before" | "other";
  courses: string[];
  message: string;
}
export interface Way {
  steps: WayStep[];
}

const MAX_WAYS = 3;
const MAX_ROUTES = 12;

function stepOf(l: LeafResult): WayStep {
  const r = l.rule;
  if (r.type === "coreq") return { kind: "alongside", courses: r.courses, message: l.message };
  if (r.type === "completed" || r.type === "minGrade") return { kind: "before", courses: r.courses, message: l.message };
  return { kind: "other", courses: [], message: l.message };
}

/** Each route is the list of unmet leaves it still needs. An empty route means the node is already satisfied. */
function routes(n: NodeResult): WayStep[][] {
  if (n.kind === "leaf") return n.leaf.state === "unmet" ? [[stepOf(n.leaf)]] : [[]];
  if (n.kind === "any") {
    const all = n.children.flatMap(routes);
    return all.some((r) => r.length === 0) ? [[]] : all.slice(0, MAX_ROUTES);
  }
  let acc: WayStep[][] = [[]];
  for (const c of n.children) {
    const next = routes(c);
    acc = acc.flatMap((a) => next.map((r) => [...a, ...r])).slice(0, MAX_ROUTES);
  }
  return acc;
}

/** Two routes that name the same classes are one choice: keep the one that also allows taking them alongside. */
function dedupe(rs: WayStep[][]): WayStep[][] {
  const key = (r: WayStep[]) => r.map((s) => [...s.courses].sort().join("+") || s.message).sort().join("|");
  const byKey = new Map<string, WayStep[]>();
  for (const r of rs) {
    const k = key(r);
    const have = byKey.get(k);
    if (!have || (r.some((s) => s.kind === "alongside") && !have.some((s) => s.kind === "alongside"))) byKey.set(k, r);
  }
  return rs.filter((r) => byKey.get(key(r)) === r);
}

export function waysIn(tree: NodeResult | null): Way[] {
  if (!tree) return [];
  return dedupe(routes(tree).filter((r) => r.length > 0))
    .sort((a, b) => a.length - b.length)
    .slice(0, MAX_WAYS)
    .map((steps) => ({ steps }));
}
