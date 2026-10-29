import { courseFit, parseRule, ruleSlugs, type EvalResult, type NodeResult, type PlanCourse } from "@/lib/eligibility";
import { db } from "@/lib/db";
import { bestFit, nodeKind, type NodeKind, type Track } from "./index";

export interface PathNode {
  id: string;
  slug: string;
  name: string;
  department: string;
  level: string;
  gradesOffered: number[];
  prereqText: string | null;
  kind: NodeKind;
  /** Grade where it fits best, or null. */
  grade: number | null;
  summary: string;
  tree: NodeResult | null;
  status: EvalResult["status"] | null;
}

export interface PathEdge {
  id: string;
  from: string;
  to: string;
  track: Track;
  kind: "STANDARD" | "ADVANCE";
  note: string | null;
}

/** Everything the pathway graph draws, with states for the signed in student's primary plan. */
export async function loadPathways(userId: string, isStudent: boolean) {
  const [edgeRows, plan, profile] = await Promise.all([
    db.courseEdge.findMany({ include: { from: true, to: true } }),
    isStudent
      ? db.plan.findFirst({ where: { ownerId: userId, isPrimary: true }, include: { entries: { include: { course: { select: { slug: true, name: true } } } } } })
      : null,
    isStudent ? db.studentProfile.findUnique({ where: { userId }, select: { eighthMath: true, eighthMathGrade: true } }) : null,
  ]);

  const courseMap = new Map<string, (typeof edgeRows)[number]["from"]>();
  for (const e of edgeRows) {
    if (!e.from.archived) courseMap.set(e.from.id, e.from);
    if (!e.to.archived) courseMap.set(e.to.id, e.to);
  }

  const names: Record<string, string> = Object.fromEntries([...courseMap.values()].map((c) => [c.slug, c.name]));
  const wantedSlugs = new Set<string>();
  for (const c of courseMap.values()) {
    const r = parseRule(c.rules);
    if (r) ruleSlugs(r).forEach((s) => wantedSlugs.add(s));
  }
  const missing = [...wantedSlugs].filter((s) => !names[s]);
  if (missing.length) {
    for (const c of await db.course.findMany({ where: { slug: { in: missing } }, select: { slug: true, name: true } })) names[c.slug] = c.name;
  }

  const placements: PlanCourse[] = (plan?.entries ?? []).map((e) => ({
    key: e.id, slug: e.course.slug, name: e.course.name, gradeLevel: e.gradeLevel, status: e.status, grade: e.grade,
    rules: null, prereqText: null, approvedAppeal: e.overrideAppealId !== null,
  }));
  const entryBySlug = new Map(placements.map((p) => [p.slug, p.status]));
  const prior = profile ?? {};

  const nodes: PathNode[] = [...courseMap.values()].map((c) => {
    const rules = parseRule(c.rules);
    // The middle school pseudo-courses are not on a plan. Mark the one the student took.
    const middle = c.slug === "algebra-i-8th-grade" ? "ALGEBRA_I" : c.slug === "pre-algebra-8th-grade" ? "PRE_ALGEBRA" : null;
    const fits = plan && c.plannable ? courseFit({ slug: c.slug, gradesOffered: c.gradesOffered, rules, prereqText: c.prereqText }, placements, { prior, names }) : [];
    const entry = middle ? (profile?.eighthMath === middle ? "COMPLETED" : null) : (entryBySlug.get(c.slug) ?? null);
    const best = bestFit(fits);
    return {
      id: c.id, slug: c.slug, name: c.name, department: c.department, level: c.level, gradesOffered: c.gradesOffered, prereqText: c.prereqText,
      kind: nodeKind({ entry, hasPlan: Boolean(plan) && c.plannable, fits }),
      grade: best?.grade ?? null,
      summary: best?.result.summary ?? "",
      tree: best?.result.tree ?? null,
      status: best?.result.status ?? null,
    };
  });

  const edges: PathEdge[] = edgeRows
    .filter((e) => courseMap.has(e.fromId) && courseMap.has(e.toId))
    .map((e) => ({ id: e.id, from: e.fromId, to: e.toId, track: e.track as Track, kind: e.kind as PathEdge["kind"], note: e.note }));

  return { nodes, edges, hasPlan: Boolean(plan) };
}
