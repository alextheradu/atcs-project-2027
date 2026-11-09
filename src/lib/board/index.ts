/**
 * The Board: one row per requirement area, one column per grade. Pure, shared by client and server.
 * Spots come only from the graduation summary (src/lib/requirements); this module adds no rules.
 * Where a spot sits is a display hint, not a requirement.
 */
import { formatCredits, fromTenths, toTenths } from "@/lib/credits";
import type { CourseTag, GraduationSummary, RequirementKind } from "@/lib/requirements";

export type RowKey = "english" | "math" | "science" | "social" | "language" | "pe" | "arts" | "life" | "finlit" | "elective";
export type Grade = 9 | 10 | 11 | 12;
export const GRADES: Grade[] = [9, 10, 11, 12];

export interface BoardEntry { id: string; name: string; gradeLevel: number; tags: CourseTag[] }
export interface Spot { row: RowKey; kind: RequirementKind; gradeLevel: Grade; credits: number; label: string }
export interface BoardCell { entryIds: string[]; spots: Spot[] }
export interface BoardRow { key: RowKey; label: string; status: string; cells: Record<Grade, BoardCell> }

export const ROWS: { key: RowKey; label: string; kinds: RequirementKind[] }[] = [
  { key: "english", label: "English", kinds: ["ENGLISH"] },
  { key: "math", label: "Math", kinds: ["MATH"] },
  { key: "science", label: "Science", kinds: ["SCI_BIO", "SCI_CHEM", "SCI_PHYS"] },
  { key: "social", label: "Social studies", kinds: ["SOCIAL_STUDIES"] },
  { key: "language", label: "World language", kinds: ["WORLD_LANG"] },
  { key: "pe", label: "PE and Health", kinds: ["PE_HEALTH"] },
  { key: "arts", label: "Arts", kinds: ["ARTS"] },
  { key: "life", label: "Life and careers", kinds: ["LIFE_CAREERS"] },
  { key: "finlit", label: "Financial literacy", kinds: ["FIN_LIT"] },
  { key: "elective", label: "Electives", kinds: [] },
];

const ROW_OF = new Map<RequirementKind, RowKey>(ROWS.flatMap((r) => r.kinds.map((k) => [k, r.key] as const)));
const ROW_INDEX = new Map<RowKey, number>(ROWS.map((r, i) => [r.key, i]));

/** What a spot asks for, in words a student uses. Fixed here so a long rule label never ends up on a tile. */
export const KIND_NOUN: Record<RequirementKind, string> = {
  ENGLISH: "English", MATH: "math", SCI_BIO: "biology", SCI_CHEM: "chemistry", SCI_PHYS: "physics",
  SOCIAL_STUDIES: "social studies", WORLD_LANG: "language", PE_HEALTH: "PE and health", ARTS: "arts",
  LIFE_CAREERS: "life and careers", FIN_LIT: "financial literacy",
};
const spotLabel = (kind: RequirementKind) => `Pick ${/^[aeiou]/i.test(KIND_NOUN[kind]) ? "an" : "a"} ${KIND_NOUN[kind]} class`;

/** One typical class: a half-year for Financial Literacy, a full year for everything else. In tenths. */
const spotSize = (kind: RequirementKind) => (kind === "FIN_LIT" ? 25 : 50);

/** The row a class sits in: its biggest requirement tag, ties broken by row order. No tags means Electives. */
export function rowFor(tags: CourseTag[]): RowKey {
  let best: { row: RowKey; credits: number; index: number } | null = null;
  for (const t of tags) {
    const row = ROW_OF.get(t.kind);
    if (!row) continue;
    const credits = toTenths(t.credits);
    const index = ROW_INDEX.get(row) as number;
    if (!best || credits > best.credits || (credits === best.credits && index < best.index)) best = { row, credits, index };
  }
  return best?.row ?? "elective";
}

const toGrade = (g: number): Grade => Math.min(12, Math.max(9, g)) as Grade;

export function spotsFor(summary: GraduationSummary, entries: BoardEntry[], currentGrade: number | null): Spot[] {
  const start = toGrade(currentGrade ?? 9);
  const missing = new Map(summary.kinds.map((k) => [k.kind, toTenths(k.missing)]));
  const spots: Spot[] = [];
  for (const row of ROWS) {
    const filled = new Set(entries.filter((e) => rowFor(e.tags) === row.key).map((e) => e.gradeLevel));
    const open = GRADES.filter((g) => g >= start && !filled.has(g));
    let i = 0;
    for (const kind of row.kinds) {
      let left = missing.get(kind) ?? 0;
      const size = spotSize(kind);
      while (left > 0) {
        const credits = Math.min(size, left);
        spots.push({ row: row.key, kind, gradeLevel: open[i] ?? 12, credits: fromTenths(credits), label: spotLabel(kind) });
        left -= credits;
        i++;
      }
    }
  }
  return spots;
}

export function buildBoard(entries: BoardEntry[], summary: GraduationSummary, currentGrade: number | null): BoardRow[] {
  const spots = spotsFor(summary, entries, currentGrade);
  const met = new Map(summary.kinds.map((k) => [k.kind, k.met]));
  return ROWS.map((row) => {
    const cells = Object.fromEntries(GRADES.map((g) => [g, { entryIds: [], spots: [] } as BoardCell])) as Record<Grade, BoardCell>;
    for (const e of entries) if (rowFor(e.tags) === row.key) cells[toGrade(e.gradeLevel)].entryIds.push(e.id);
    const mine = spots.filter((s) => s.row === row.key);
    for (const s of mine) cells[s.gradeLevel].spots.push(s);
    const status = row.kinds.length === 0 ? "Any class" : mine.length > 0 ? `${mine.length} more` : row.kinds.every((k) => met.get(k) ?? true) ? "Done" : "";
    return { key: row.key, label: row.label, status, cells };
  });
}

/** The one line at the top of the Board. */
export function statusSentence(summary: GraduationSummary, spotCount: number): string {
  const head = `${formatCredits(summary.total)} of ${formatCredits(summary.totalRequired)} credits.`;
  if (summary.complete) return `${head} You have everything you need to graduate.`;
  if (spotCount > 0) return `${head} ${spotCount} empty ${spotCount === 1 ? "spot" : "spots"} left to graduate.`;
  return `${head} Add ${formatCredits(summary.missing)} more credits of any classes to graduate.`;
}
