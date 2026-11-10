/**
 * How each subject's classes follow one another at Pascack, drawn the way the Program of Studies draws its
 * "Typical Paths" charts: years left to right, levels stacked with the highest on top. Math, science and
 * computer science copy those charts (p. 36 and p. 45). English, social studies and world language have no
 * chart, so their maps follow the course order and the level rules in each department's section.
 *
 * Every move here is traceable to a chart arrow, a prerequisite, or a written level rule. Placement is
 * the school's call, so this only explains the system. Pure.
 */
import { z } from "zod";

export const SUBJECTS = ["math", "science", "english", "social", "language", "cs"] as const;
export type Subject = (typeof SUBJECTS)[number];
export const SUBJECT_LABEL: Record<Subject, string> = {
  math: "Math",
  science: "Science",
  english: "English",
  social: "Social studies",
  language: "World language",
  cs: "Computer science",
};

/** What a student took in 8th grade. The math charts start from one of the two. */
export const MATH_STARTS = ["algebra", "prealgebra"] as const;
export type MathStart = (typeof MATH_STARTS)[number];
export const START_LABEL: Record<MathStart, string> = { algebra: "Algebra I", prealgebra: "Pre-Algebra" };

export const LANGUAGES = ["spanish", "french", "italian", "chinese"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_LABEL: Record<Language, string> = { spanish: "Spanish", french: "French", italian: "Italian", chinese: "Chinese" };

/** The Pathways view's search params. Anything unknown falls back to the default. */
export const pathwayQuerySchema = z.object({
  subject: z.enum(SUBJECTS).optional().catch(undefined),
  start: z.enum(MATH_STARTS).optional().catch(undefined),
  lang: z.enum(LANGUAGES).optional().catch(undefined),
});

/** next: the usual step at the same level. up and down: changing level between years. */
export type MoveKind = "next" | "up" | "down";

export interface MapCell {
  id: string;
  col: number;
  /** 0 is the top lane, the highest level. "all" centers the cell across every lane (a starting point). */
  lane: number | "all";
  /** Columns the cell covers. Its classes sit side by side, one per column. */
  span?: number;
  /** Classes that are choices at this spot, in display order. */
  slugs: string[];
  /** A short caption above the classes, for a group that needs one ("Electives, 11th or 12th"). */
  note?: string;
}

export interface PathMap {
  key: string;
  subject: Subject;
  /** What the map shows, for screen readers. */
  title: string;
  columns: string[];
  lanes: string[];
  cells: MapCell[];
  moves: { from: string; to: string; kind: MoveKind }[];
  /** How moving between levels works in this subject, each with its printed page. */
  rules: { text: string; page: number }[];
  source: string;
}

type Move = PathMap["moves"][number];
const next = (from: string, to: string): Move => ({ from, to, kind: "next" });
const up = (from: string, to: string): Move => ({ from, to, kind: "up" });
const down = (from: string, to: string): Move => ({ from, to, kind: "down" });

const MATH_ALGEBRA: PathMap = {
  key: "math-algebra",
  subject: "math",
  title: "Math, starting from Algebra I in 8th grade",
  columns: ["8th grade", "9th grade", "10th grade", "11th grade", "12th grade"],
  lanes: ["Honors and AP", "Enhanced", "College prep"],
  cells: [
    { id: "start", col: 0, lane: "all", slugs: ["algebra-i-8th-grade"] },
    { id: "hg", col: 1, lane: 0, slugs: ["honors-geometry"] },
    { id: "ge", col: 1, lane: 1, slugs: ["geometry-enhanced"] },
    { id: "ha2", col: 2, lane: 0, slugs: ["honors-algebra-ii-with-trigonometry"] },
    { id: "a2e", col: 2, lane: 1, slugs: ["algebra-ii-with-trigonometry-enhanced"] },
    { id: "a2", col: 2, lane: 2, slugs: ["algebra-ii-with-trigonometry"] },
    { id: "apc", col: 3, lane: 0, slugs: ["ap-pre-calculus"] },
    { id: "pc", col: 3, lane: 1, slugs: ["pre-calculus"] },
    { id: "electives", col: 3, lane: 2, span: 2, slugs: ["college-algebra", "statistics", "discrete-math", "ap-statistics"], note: "Electives, 11th or 12th grade" },
    { id: "apcalc", col: 4, lane: 0, slugs: ["ap-calculus-bc", "ap-calculus-ab"] },
    { id: "calc", col: 4, lane: 1, slugs: ["calculus"] },
  ],
  moves: [
    next("start", "hg"), next("start", "ge"),
    next("hg", "ha2"), down("hg", "a2e"),
    next("ge", "a2e"), up("ge", "ha2"), down("ge", "a2"),
    next("ha2", "apc"), down("ha2", "pc"),
    next("a2e", "pc"), up("a2e", "apc"), down("a2e", "electives"),
    next("a2", "electives"),
    next("apc", "apcalc"), down("apc", "calc"),
    next("pc", "calc"), up("pc", "apcalc"),
  ],
  rules: [
    { text: "Honors Geometry in 9th grade is by supervisor recommendation. It looks at your 8th grade Algebra I grades, a placement exam and a teacher evaluation.", page: 37 },
    { text: "To stay in Honors, keep a B average or better.", page: 37 },
    { text: "You can move up into Honors later, based on your math grades, a placement exam and a teacher recommendation.", page: 37 },
    { text: "Teachers can also recommend moving from Honors down to Enhanced.", page: 37 },
    { text: "After Algebra II with Trigonometry you can take College Algebra, Statistics or Discrete Math. A B+ or higher in College Algebra can lead on to AP Statistics, or to Pre-Calculus with a placement exam.", page: 32 },
    { text: "After AP Calculus BC you can take Advanced Topics in Calculus (Honors).", page: 33 },
  ],
  source: "Typical Math Paths chart, Program of Studies p. 36",
};

const MATH_PREALGEBRA: PathMap = {
  key: "math-prealgebra",
  subject: "math",
  title: "Math, starting from Pre-Algebra in 8th grade",
  columns: ["8th grade", "9th grade", "10th grade", "11th grade", "12th grade"],
  lanes: ["Enhanced", "College prep"],
  cells: [
    { id: "start", col: 0, lane: "all", slugs: ["pre-algebra-8th-grade"] },
    { id: "ge", col: 1, lane: 0, slugs: ["geometry-enhanced"] },
    { id: "g", col: 1, lane: 1, slugs: ["geometry"] },
    { id: "a1e", col: 2, lane: 0, slugs: ["algebra-i-enhanced"] },
    { id: "a1", col: 2, lane: 1, slugs: ["algebra-i"] },
    { id: "a2e", col: 3, lane: 0, slugs: ["algebra-ii-with-trigonometry-enhanced"] },
    { id: "a2", col: 3, lane: 1, slugs: ["algebra-ii-with-trigonometry"] },
    { id: "after", col: 4, lane: 0, slugs: ["ap-statistics", "pre-calculus"] },
    { id: "electives", col: 4, lane: 1, slugs: ["college-algebra", "statistics", "discrete-math"], note: "Electives" },
  ],
  moves: [
    next("start", "ge"), next("start", "g"),
    next("ge", "a1e"), down("ge", "a1"),
    next("g", "a1"), up("g", "a1e"),
    next("a1e", "a2e"), down("a1e", "a2"),
    next("a1", "a2"), up("a1", "a2e"),
    next("a2e", "after"), down("a2e", "electives"),
    next("a2", "electives"),
  ],
  rules: [
    { text: "Geometry Enhanced in 9th grade needs a B- or higher in 8th grade math and a teacher and supervisor recommendation.", page: 30 },
    { text: "To move up from College prep to Enhanced, you need a test and quiz average of A or higher in your College prep class.", page: 30 },
    { text: "To stay in Enhanced, you need a test and quiz average of C+ or higher.", page: 30 },
    { text: "If you did very well in Math 8, you may be able to take Geometry Enhanced and Algebra I Enhanced together in 9th grade, which leads to Calculus. Ask the math supervisor.", page: 37 },
  ],
  source: "Typical Math Paths chart, Program of Studies p. 36",
};

const SCIENCE: PathMap = {
  key: "science",
  subject: "science",
  title: "Science",
  columns: ["9th grade", "10th grade", "11th grade"],
  lanes: ["Honors and AP", "Enhanced", "College prep"],
  cells: [
    { id: "hb", col: 0, lane: 0, slugs: ["honors-biology"] },
    { id: "be", col: 0, lane: 1, slugs: ["biology-enhanced"] },
    { id: "b", col: 0, lane: 2, slugs: ["biology"] },
    { id: "hc", col: 1, lane: 0, slugs: ["honors-chemistry"] },
    { id: "ce", col: 1, lane: 1, slugs: ["chemistry-enhanced"] },
    { id: "c", col: 1, lane: 2, slugs: ["chemistry"] },
    { id: "hp", col: 2, lane: 0, slugs: ["ap-physics-i", "honors-physics"] },
    { id: "pe", col: 2, lane: 1, slugs: ["physics-enhanced"] },
    { id: "p", col: 2, lane: 2, slugs: ["physics"] },
  ],
  moves: [
    next("hb", "hc"), down("hb", "ce"),
    next("be", "ce"), up("be", "hc"), down("be", "c"),
    next("b", "c"), up("b", "ce"),
    next("hc", "hp"),
    next("ce", "pe"), up("ce", "hp"), down("ce", "p"),
    next("c", "p"), up("c", "pe"),
  ],
  rules: [
    { text: "To stay in Honors, keep a B average for the year.", page: 38 },
    { text: "To be considered for Honors next year, you need an A (93 or above) for the year in Enhanced.", page: 38 },
    { text: "To move from College prep up to Enhanced, you need an A (93 or above) for the year.", page: 38 },
    { text: "Honors Chemistry and Honors Physics use a lot of math, so Honors math is highly recommended.", page: 38 },
    { text: "Any physics class can be swapped for Applied Physics and Engineering, a two period, 10 credit class.", page: 45 },
    { text: "After these three, you can add science electives and AP sciences. Each has its own prerequisites.", page: 45 },
  ],
  source: "Typical Science Paths chart, Program of Studies p. 45",
};

const CS: PathMap = {
  key: "cs",
  subject: "cs",
  title: "Computer science",
  columns: ["Any grade", "10th to 12th grade", "11th or 12th grade", "12th grade"],
  lanes: [""],
  cells: [
    { id: "intro", col: 0, lane: 0, slugs: ["introduction-to-computer-science-and-app-development"] },
    { id: "hcs", col: 1, lane: 0, slugs: ["honors-computer-science"] },
    { id: "apcs", col: 2, lane: 0, slugs: ["ap-computer-science-a"] },
    { id: "adv", col: 3, lane: 0, slugs: ["advanced-topics-in-computer-science-honors"] },
  ],
  moves: [next("intro", "hcs"), next("hcs", "apcs"), next("apcs", "adv")],
  rules: [
    { text: "You can start at Honors Computer Science without the intro class if you have taken or are taking Honors Algebra II or Algebra II Enhanced and really like programming.", page: 35 },
    { text: "Honors Computer Science and AP Computer Science A are by teacher and supervisor recommendation.", page: 35 },
    { text: "Levels may change with a teacher recommendation.", page: 36 },
  ],
  source: "Typical Comp Sci Paths chart, Program of Studies p. 36",
};

const ENGLISH: PathMap = {
  key: "english",
  subject: "english",
  title: "English",
  columns: ["9th grade", "10th grade", "11th grade", "12th grade"],
  lanes: ["Honors", "College prep"],
  cells: [
    { id: "h1", col: 0, lane: 0, slugs: ["honors-english-i"] },
    { id: "e1", col: 0, lane: 1, slugs: ["english-i"] },
    { id: "h2", col: 1, lane: 0, slugs: ["honors-english-ii"] },
    { id: "e2", col: 1, lane: 1, slugs: ["english-ii"] },
    { id: "h3", col: 2, lane: 0, slugs: ["honors-english-iii"] },
    { id: "e3", col: 2, lane: 1, slugs: ["english-iii"] },
    { id: "h4", col: 3, lane: 0, slugs: ["honors-english-iv"] },
    { id: "e4", col: 3, lane: 1, slugs: ["english-iv"] },
  ],
  moves: [
    next("h1", "h2"), next("h2", "h3"), next("h3", "h4"),
    next("e1", "e2"), next("e2", "e3"), next("e3", "e4"),
    up("e1", "h2"), up("e2", "h3"), up("e3", "h4"),
    down("h1", "e2"), down("h2", "e3"), down("h3", "e4"),
  ],
  rules: [
    { text: "Honors placement is by teacher, supervisor and principal recommendation.", page: 15 },
    { text: "To stay in Honors, keep a B average.", page: 15 },
    { text: "To move up from College prep, you need an A (93 or above) average in 9th grade, or a 90 average or better in 10th or 11th grade.", page: 15 },
    { text: "AP English classes need a 90 average in Honors English.", page: 16 },
    { text: "AP Capstone Seminar in 10th grade leads to AP Capstone Research.", page: 18 },
  ],
  source: "English course order and level rules, Program of Studies p. 15 to 18",
};

const SOCIAL: PathMap = {
  key: "social",
  subject: "social",
  title: "Social studies",
  columns: ["9th grade", "10th grade", "11th grade"],
  lanes: ["Honors and AP", "College prep"],
  cells: [
    { id: "hwh", col: 0, lane: 0, slugs: ["honors-world-history"] },
    { id: "wh", col: 0, lane: 1, slugs: ["world-history"] },
    { id: "h1", col: 1, lane: 0, slugs: ["honors-u-s-history-i", "ap-u-s-history-i"] },
    { id: "us1", col: 1, lane: 1, slugs: ["u-s-history-i"] },
    { id: "h2", col: 2, lane: 0, slugs: ["honors-u-s-history-ii", "ap-u-s-history-ii"] },
    { id: "us2", col: 2, lane: 1, slugs: ["u-s-history-ii"] },
  ],
  moves: [
    next("hwh", "h1"), down("hwh", "us1"),
    next("wh", "us1"), up("wh", "h1"),
    next("h1", "h2"), down("h1", "us2"),
    next("us1", "us2"), up("us1", "h2"),
  ],
  rules: [
    { text: "Everyone takes World History in 9th grade, U.S. History I in 10th and U.S. History II in 11th.", page: 23 },
    { text: "Honors and AP placement is by teacher and supervisor recommendation.", page: 23 },
    { text: "To move up to Honors or AP, you need at least an A.", page: 23 },
    { text: "To stay in Honors or AP, keep a B average.", page: 23 },
  ],
  source: "Social studies course order and level rules, Program of Studies p. 23",
};

function languageMap(lang: Language): PathMap {
  const s = (level: string) => `${lang}-${level}`;
  return {
    key: `language-${lang}`,
    subject: "language",
    title: LANGUAGE_LABEL[lang],
    columns: ["Level I", "Level II", "Level III", "Level IV", "Level V or AP"],
    lanes: ["Honors and AP", "College prep"],
    cells: [
      { id: "l1", col: 0, lane: 1, slugs: [s("i")] },
      { id: "l2", col: 1, lane: 1, slugs: [s("ii")] },
      { id: "l3", col: 2, lane: 1, slugs: [s("iii")] },
      { id: "l4", col: 3, lane: 1, slugs: [s("iv")] },
      { id: "l5", col: 4, lane: 1, slugs: [s("v")] },
      { id: "h2", col: 1, lane: 0, slugs: [`honors-${s("ii")}`] },
      { id: "h3", col: 2, lane: 0, slugs: [`honors-${s("iii")}`] },
      { id: "h4", col: 3, lane: 0, slugs: [`honors-${s("iv")}`] },
      { id: "ap", col: 4, lane: 0, slugs: [`ap-${lang}-language-and-culture`] },
    ],
    moves: [
      next("l1", "l2"), next("l2", "l3"), next("l3", "l4"), next("l4", "l5"),
      next("h2", "h3"), next("h3", "h4"), next("h4", "ap"),
      up("l1", "h2"), up("l2", "h3"), up("l3", "h4"),
      down("h2", "l3"), down("h3", "l4"), down("h4", "l5"),
    ],
    rules: [
      { text: "If you studied the language in middle school, you will likely start at Level II.", page: 46 },
      { text: "Joining Honors is by self-nomination.", page: 46 },
      { text: "Each year your teacher recommends whether you stay in Honors.", page: 47 },
      { text: "AP needs the Honors sequence and a teacher and supervisor recommendation.", page: 47 },
      ...(lang === "spanish"
        ? [{ text: "AP Spanish Literature and Culture comes after AP Spanish Language and Culture or Spanish for Heritage Speakers III.", page: 48 }]
        : []),
    ],
    source: "World language levels, Program of Studies p. 46 to 48",
  };
}

/** The map for a subject. Math starts from Algebra I and languages from Spanish unless told otherwise. */
export function pathMap(subject: Subject, opts: { start?: MathStart; lang?: Language }): PathMap {
  switch (subject) {
    case "math":
      return opts.start === "prealgebra" ? MATH_PREALGEBRA : MATH_ALGEBRA;
    case "science":
      return SCIENCE;
    case "english":
      return ENGLISH;
    case "social":
      return SOCIAL;
    case "language":
      return languageMap(opts.lang ?? "spanish");
    case "cs":
      return CS;
  }
}

export function allMaps(): PathMap[] {
  return [MATH_ALGEBRA, MATH_PREALGEBRA, SCIENCE, ENGLISH, SOCIAL, ...LANGUAGES.map(languageMap), CS];
}

export function mapSlugs(map: PathMap): string[] {
  return map.cells.flatMap((c) => c.slugs);
}

/** Leaves out classes the catalog no longer has, then any cell left empty and the moves that touch it. */
export function pruneMap(map: PathMap, available: Set<string>): PathMap {
  if (mapSlugs(map).every((s) => available.has(s))) return map;
  const cells = map.cells.map((c) => ({ ...c, slugs: c.slugs.filter((s) => available.has(s)) })).filter((c) => c.slugs.length > 0);
  const ids = new Set(cells.map((c) => c.id));
  return { ...map, cells, moves: map.moves.filter((m) => ids.has(m.from) && ids.has(m.to)) };
}
