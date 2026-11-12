/** Search relevance for the Classes list. Pure, no framework imports. */

interface Searchable {
  name: string;
  department: string;
}

/**
 * Lower is better: 0 title starts with the query, 1 a word in the title starts with it,
 * 2 the title contains it, 3 only the description matched (the database already filtered).
 */
export function searchRank(c: { name: string }, query: string): number {
  const q = query.trim().toLowerCase();
  const name = c.name.toLowerCase();
  if (!q) return 0;
  if (name.startsWith(q)) return 0;
  if (name.split(/[\s\-/(]+/).some((w) => w.startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  return 3;
}

/**
 * Groups courses by department. With a query, subjects holding the best title match come first and
 * title matches lead inside each subject. Ties keep the incoming (catalog) order, since sort is stable.
 */
export function rankByQuery<T extends Searchable>(courses: T[], query: string): [string, T[]][] {
  const rank = new Map(courses.map((c) => [c, searchRank(c, query)]));
  const groups = [...Map.groupBy(courses, (c) => c.department)].map(
    ([dept, rows]) => [dept, rows.toSorted((a, b) => rank.get(a)! - rank.get(b)!)] as [string, T[]],
  );
  const best = (rows: T[]) => rank.get(rows[0])!;
  return groups.toSorted((a, b) => best(a[1]) - best(b[1]));
}
