/** Orders add-class results by how well each class fits the chosen grade. Pure, no framework imports. */

import { isCoreqOnly } from "../eligibility/labels";
import type { EvalResult } from "../eligibility/types";

type Fit = Pick<EvalResult, "status" | "viaAppeal"> & { unmet?: Pick<EvalResult["unmet"][number], "rule">[] };

/** College prep first: the usual next step, not the hardest one. */
const LEVEL_ORDER = ["CP", "ENHANCED", "HONORS", "AP"];

const RANK: Record<Fit["status"], number> = {
  ELIGIBLE: 0,
  ELIGIBLE_WITH_WARNING: 1,
  NOT_ELIGIBLE_APPEALABLE: 2,
  NOT_ELIGIBLE_LOCKED: 3,
};

/** Lower is better. An approved appeal counts as a class the student can take. No result sorts last. */
export function fitRank(fit: Fit | undefined): number {
  if (!fit) return 4;
  if (fit.viaAppeal) return 0;
  // Only a partner class missing: fixed by adding a class, so it sits with the warnings.
  if (fit.status !== "ELIGIBLE" && fit.unmet && isCoreqOnly({ unmet: fit.unmet as EvalResult["unmet"] })) return 1;
  return RANK[fit.status];
}

/**
 * Sorts by fit tier. Rows in the same tier keep their incoming order (search relevance, then name), unless `levelOf`
 * is given: then each tier runs from College prep up. Pass it only when there is no search, so relevance still wins.
 */
export function sortByFit<T>(rows: readonly T[], fitOf: (row: T) => Fit | undefined, levelOf?: (row: T) => string): T[] {
  const rank = new Map(rows.map((r) => [r, fitRank(fitOf(r))]));
  const lvl = (r: T) => {
    const i = levelOf ? LEVEL_ORDER.indexOf(levelOf(r)) : 0;
    return i < 0 ? LEVEL_ORDER.length : i;
  };
  return rows.toSorted((a, b) => rank.get(a)! - rank.get(b)! || lvl(a) - lvl(b));
}
