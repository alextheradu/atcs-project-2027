/**
 * Match transcript titles to catalog courses. Pure.
 *
 * Order: exact alias, exact catalog name, then Fuse.js fuzzy with a confidence score.
 * Confidence bands (documented, tested):
 *   exact alias or name   1.00   "exact"
 *   fuzzy, 0.80 and up            "good"   pre-selected, the student can still change it
 *   fuzzy, 0.55 to 0.80           "check"  pre-selected but flagged
 *   fuzzy, below 0.55             "none"   nothing pre-selected
 * A fuzzy hit whose level word (honors, AP, enhanced) or course number (I, II, III, 9) differs from the
 * transcript title is capped at 0.50, so "Honors Biology" never quietly becomes "Biology".
 */
import Fuse from "fuse.js";
import { normalizeTitle } from "@/lib/catalog/normalize";

export interface CatalogCourse {
  id: string;
  name: string;
  archived: boolean;
}

export interface AliasRow {
  /** Already normalized. */
  alias: string;
  courseId: string;
}

export type Band = "exact" | "good" | "check" | "none";

export interface Candidate {
  courseId: string;
  name: string;
  confidence: number;
}

export interface MatchResult {
  courseId: string | null;
  via: "alias" | "name" | "fuzzy" | "none";
  confidence: number;
  band: Band;
  /** The best few, for the fix dropdown. */
  candidates: Candidate[];
}

export const GOOD_AT = 0.8;
export const CHECK_AT = 0.55;
const MISMATCH_CAP = 0.5;
const LEVEL_WORDS = new Set(["honors", "ap", "enhanced"]);
const NUMBER_WORD = /^(i{1,3}|iv|v|vi{0,3}|\d{1,2})$/;

/** The key titles are compared by. A trailing "(H)" means honors on transcripts. */
export function matchKey(title: string): string {
  return normalizeTitle(title).replace(/\bh$/, "honors");
}

const tokens = (key: string) => key.split(" ").filter(Boolean);
const levelOf = (key: string) => tokens(key).filter((t) => LEVEL_WORDS.has(t)).sort().join(" ");
const numbersOf = (key: string) => tokens(key).filter((t) => NUMBER_WORD.test(t)).sort().join(" ");

export const bandFor = (confidence: number, exact: boolean): Band =>
  exact ? "exact" : confidence >= GOOD_AT ? "good" : confidence >= CHECK_AT ? "check" : "none";

export function createMatcher(catalog: CatalogCourse[], aliases: AliasRow[]) {
  const keyed = catalog.map((c) => ({ ...c, key: matchKey(c.name) }));
  const byKey = new Map<string, (typeof keyed)[number]>();
  // Live courses win over archived ones when two share a name.
  for (const c of [...keyed].sort((a, b) => Number(b.archived) - Number(a.archived))) byKey.set(c.key, c);
  const aliasMap = new Map(aliases.map((a) => [a.alias, a.courseId]));
  const names = new Map(catalog.map((c) => [c.id, c.name]));
  const fuse = new Fuse(keyed, { keys: ["key"], includeScore: true, threshold: 0.6, ignoreLocation: true, minMatchCharLength: 2 });

  return function match(title: string): MatchResult {
    const key = matchKey(title);

    const aliased = aliasMap.get(key);
    if (aliased && names.has(aliased)) {
      return { courseId: aliased, via: "alias", confidence: 1, band: "exact", candidates: [{ courseId: aliased, name: names.get(aliased)!, confidence: 1 }] };
    }
    const exact = byKey.get(key);
    if (exact) {
      return { courseId: exact.id, via: "name", confidence: 1, band: "exact", candidates: [{ courseId: exact.id, name: exact.name, confidence: 1 }] };
    }

    const wantLevel = levelOf(key);
    const wantNumbers = numbersOf(key);
    const candidates = fuse
      .search(key, { limit: 6 })
      .map((r) => {
        let confidence = 1 - (r.score ?? 1);
        if (levelOf(r.item.key) !== wantLevel || numbersOf(r.item.key) !== wantNumbers) confidence = Math.min(confidence, MISMATCH_CAP);
        return { courseId: r.item.id, name: r.item.name, confidence: Math.round(confidence * 100) / 100 };
      })
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

    const top = candidates[0];
    if (!top || top.confidence < CHECK_AT) return { courseId: null, via: "none", confidence: top?.confidence ?? 0, band: "none", candidates };
    return { courseId: top.courseId, via: "fuzzy", confidence: top.confidence, band: bandFor(top.confidence, false), candidates };
  };
}
