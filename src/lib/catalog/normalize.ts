/**
 * Canonical form for course titles. Used for aliases and transcript matching,
 * so catalog names and transcript names meet in the same shape.
 */
const WORD_MAP: Record<string, string> = {
  hon: "honors",
  eng: "english",
  and: "and",
};

export function normalizeTitle(title: string): string {
  let s = title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s
    .replace(/\badvanced placement\b/g, "ap")
    .replace(/\bunited states\b/g, "us")
    .replace(/\bu s\b/g, "us");

  return s
    .split(" ")
    .map((w) => WORD_MAP[w] ?? w)
    .join(" ");
}
