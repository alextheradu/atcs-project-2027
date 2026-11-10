import { rowFor, type RowKey } from "@/lib/board";
import { db } from "@/lib/db";
import { boardPlanId } from "@/lib/plans/load";
import type { RequirementKind } from "@/lib/requirements";
import { LANGUAGES, type Language, type MathStart } from "./maps";

export interface MapClass {
  slug: string;
  name: string;
  level: string;
  /** Board row, which picks the subject color. */
  row: RowKey;
}

export type MapStatus = "COMPLETED" | "IN_PROGRESS" | "PLANNED";

/** Name, level and Board row for each class on a map, by slug. Archived classes are left out. */
export async function loadMapClasses(slugs: string[]): Promise<Record<string, MapClass>> {
  const rows = await db.course.findMany({
    where: { slug: { in: slugs }, archived: false },
    select: { slug: true, name: true, level: true, requirements: { select: { kind: true, credits: true, provisional: true } } },
  });
  return Object.fromEntries(
    rows.map((c) => [
      c.slug,
      {
        slug: c.slug,
        name: c.name,
        level: c.level,
        row: rowFor(c.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional }))),
      },
    ]),
  );
}

const RANK: Record<MapStatus, number> = { COMPLETED: 3, IN_PROGRESS: 2, PLANNED: 1 };

/**
 * What the signed-in student told us in onboarding (8th grade math, a language) and where each class sits on
 * their Board. Only their own plan, so the map can say "Done" or "In your plan" on a class.
 */
export async function loadPathwayStudent(userId: string): Promise<{ start: MathStart | null; lang: Language | null; status: Record<string, MapStatus> }> {
  const [profile, planId] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId }, select: { eighthMath: true, languageStudied: true } }),
    boardPlanId(userId),
  ]);
  const entries = planId
    ? await db.planEntry.findMany({ where: { planId, plan: { ownerId: userId } }, select: { status: true, course: { select: { slug: true } } } })
    : [];

  const status: Record<string, MapStatus> = {};
  // A class can sit on the Board twice (a repeat). Show the furthest along.
  for (const e of entries) {
    const prev = status[e.course.slug];
    if (!prev || RANK[e.status] > RANK[prev]) status[e.course.slug] = e.status;
  }

  const start = profile?.eighthMath === "PRE_ALGEBRA" ? "prealgebra" : profile?.eighthMath === "ALGEBRA_I" ? "algebra" : null;
  const lang = LANGUAGES.find((l) => l === profile?.languageStudied) ?? null;
  return { start, lang, status };
}
