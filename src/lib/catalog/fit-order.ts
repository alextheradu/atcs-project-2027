/** Orders add-class results by how well each class fits the chosen grade. Pure, no framework imports. */

import type { EvalResult } from "../eligibility/types";

type Fit = Pick<EvalResult, "status" | "viaAppeal">;

const RANK: Record<Fit["status"], number> = {
  ELIGIBLE: 0,
  ELIGIBLE_WITH_WARNING: 1,
  NOT_ELIGIBLE_APPEALABLE: 2,
  NOT_ELIGIBLE_LOCKED: 3,
};

/** Lower is better. An approved appeal counts as a class the student can take. No result sorts last. */
export function fitRank(fit: Fit | undefined): number {
  if (!fit) return 4;
  return fit.viaAppeal ? 0 : RANK[fit.status];
}

/** Sorts by fit tier. Rows in the same tier keep their incoming order (search relevance, then name). */
export function sortByFit<T>(rows: readonly T[], fitOf: (row: T) => Fit | undefined): T[] {
  const rank = new Map(rows.map((r) => [r, fitRank(fitOf(r))]));
  return rows.toSorted((a, b) => rank.get(a)! - rank.get(b)!);
}
