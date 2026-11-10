import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGUAGES, SUBJECTS, allMaps, mapSlugs, pathMap, pathwayQuerySchema, pruneMap, type MapCell, type PathMap } from "./maps";
import { COMPACT, SIZE, layoutMap } from "./layout";

const courses = JSON.parse(readFileSync(path.resolve("prisma/seed/courses.json"), "utf8")) as { slug: string }[];
const known = new Set(courses.map((c) => c.slug));

const cellOf = (map: PathMap, id: string): MapCell => {
  const c = map.cells.find((x) => x.id === id);
  if (!c) throw new Error(`${map.key}: no cell ${id}`);
  return c;
};

describe("pathway maps", () => {
  const maps = allMaps();

  it("covers every subject and language", () => {
    const keys = maps.map((m) => m.key);
    expect(keys).toContain("math-algebra");
    expect(keys).toContain("math-prealgebra");
    for (const l of LANGUAGES) expect(keys).toContain(`language-${l}`);
    for (const s of SUBJECTS) expect(maps.some((m) => m.subject === s)).toBe(true);
  });

  it.each(maps.map((m) => [m.key, m] as const))("%s only names real classes, once each", (_, map) => {
    const slugs = map.cells.flatMap((c) => c.slugs);
    expect(slugs.filter((s) => !known.has(s))).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(map.cells.map((c) => c.id)).size).toBe(map.cells.length);
  });

  it.each(maps.map((m) => [m.key, m] as const))("%s keeps cells inside the grid", (_, map) => {
    for (const c of map.cells) {
      expect(c.col).toBeGreaterThanOrEqual(0);
      expect(c.col + (c.span ?? 1)).toBeLessThanOrEqual(map.columns.length);
      if (c.lane !== "all") expect(c.lane).toBeLessThan(map.lanes.length);
      expect(c.slugs.length).toBeGreaterThan(0);
    }
  });

  it.each(maps.map((m) => [m.key, m] as const))("%s draws each move one column right, in the direction its kind says", (_, map) => {
    for (const m of map.moves) {
      const from = cellOf(map, m.from);
      const to = cellOf(map, m.to);
      expect(to.col, `${m.from} -> ${m.to}`).toBe(from.col + (from.span ?? 1));
      if (from.lane === "all" || to.lane === "all") {
        expect(m.kind).toBe("next");
        continue;
      }
      if (m.kind === "next") expect(to.lane, `${m.from} -> ${m.to}`).toBe(from.lane);
      // Lane 0 is the top, the highest level.
      if (m.kind === "up") expect(to.lane, `${m.from} -> ${m.to}`).toBeLessThan(from.lane);
      if (m.kind === "down") expect(to.lane, `${m.from} -> ${m.to}`).toBeGreaterThan(from.lane);
    }
  });

  it.each(maps.map((m) => [m.key, m] as const))("%s explains its rules with a page and no em dashes", (_, map) => {
    expect(map.rules.length).toBeGreaterThan(0);
    for (const r of map.rules) expect(r.page).toBeGreaterThan(0);
    const copy = [map.title, map.source, ...map.columns, ...map.lanes, ...map.rules.map((r) => r.text)].join(" ");
    expect(copy.includes(String.fromCharCode(0x2014))).toBe(false);
  });
});

describe("pathMap", () => {
  it("starts math from Algebra I unless asked for Pre-Algebra", () => {
    expect(mapSlugs(pathMap("math", {}))).toContain("algebra-i-8th-grade");
    expect(mapSlugs(pathMap("math", { start: "prealgebra" }))).toContain("pre-algebra-8th-grade");
    expect(mapSlugs(pathMap("math", { start: "prealgebra" }))).not.toContain("honors-geometry");
  });

  it("shows one language at a time, Spanish first", () => {
    expect(mapSlugs(pathMap("language", {}))).toContain("spanish-ii");
    const french = mapSlugs(pathMap("language", { lang: "french" }));
    expect(french).toContain("honors-french-iii");
    expect(french.some((s) => s.includes("spanish"))).toBe(false);
  });
});

describe("pathwayQuerySchema", () => {
  it("keeps known values and drops anything else", () => {
    expect(pathwayQuerySchema.parse({ subject: "science", start: "prealgebra", lang: "french" })).toEqual({ subject: "science", start: "prealgebra", lang: "french" });
    expect(pathwayQuerySchema.parse({ subject: "<script>", start: "calculus", lang: "latin" })).toEqual({ subject: undefined, start: undefined, lang: undefined });
    expect(pathwayQuerySchema.parse({})).toEqual({});
  });
});

describe("pruneMap", () => {
  const map = pathMap("math", {});

  it("drops classes that are missing, then empty cells and their moves", () => {
    const available = new Set(mapSlugs(map).filter((s) => s !== "honors-geometry"));
    const pruned = pruneMap(map, available);
    expect(pruned.cells.some((c) => c.id === "hg")).toBe(false);
    expect(pruned.moves.some((m) => m.from === "hg" || m.to === "hg")).toBe(false);
    expect(pruned.moves.length).toBeLessThan(map.moves.length);
  });

  it("keeps a cell that still has a class", () => {
    const available = new Set(mapSlugs(map).filter((s) => s !== "ap-calculus-ab"));
    const cell = pruneMap(map, available).cells.find((c) => c.id === "apcalc");
    expect(cell?.slugs).toEqual(["ap-calculus-bc"]);
  });

  it("changes nothing when every class is there", () => {
    expect(pruneMap(map, new Set(mapSlugs(map)))).toEqual(map);
  });
});

describe("layoutMap", () => {
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it.each(allMaps().map((m) => [m.key, m] as const))("%s never stacks one tile on another", (_, map) => {
    const tiles = layoutMap(map).cells.flatMap((c) => c.tiles);
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) expect(overlaps(tiles[i], tiles[j])).toBe(false);
  });

  it.each(allMaps().map((m) => [m.key, m] as const))("%s runs every arrow from the right edge of one cell to the left edge of the next", (_, map) => {
    const out = layoutMap(map);
    const byId = new Map(out.cells.map((c) => [c.id, c]));
    for (const a of out.arrows) {
      const from = byId.get(a.from)!;
      const to = byId.get(a.to)!;
      expect(a.x1).toBe(from.x + from.w);
      expect(a.x2).toBe(to.x);
      expect(a.y1).toBeGreaterThanOrEqual(from.y);
      expect(a.y1).toBeLessThanOrEqual(from.y + from.h);
      expect(a.y2).toBeGreaterThanOrEqual(to.y);
      expect(a.y2).toBeLessThanOrEqual(to.y + to.h);
    }
  });

  it("keeps the normal next step flat when both classes sit in the same lane", () => {
    const out = layoutMap(pathMap("math", {}));
    const a = out.arrows.find((x) => x.from === "hg" && x.to === "ha2")!;
    expect(a.y1).toBe(a.y2);
    expect(a.d).not.toContain("C");
  });

  it("bends a move up so it ends higher than it starts", () => {
    const out = layoutMap(pathMap("math", {}));
    const a = out.arrows.find((x) => x.from === "ge" && x.to === "ha2")!;
    expect(a.kind).toBe("up");
    expect(a.y2).toBeLessThan(a.y1);
    expect(a.d).toContain("C");
  });

  it("centers a starting class across every lane", () => {
    const out = layoutMap(pathMap("math", { start: "prealgebra" }));
    const start = out.cells.find((c) => c.id === "start")!;
    const top = out.lanes[0].y;
    const bottom = out.lanes.at(-1)!.y + out.lanes.at(-1)!.h;
    expect(start.y + start.h / 2).toBe((top + bottom) / 2);
  });

  it("is as wide as its columns and leaves no room for lane labels when there are none", () => {
    const math = layoutMap(pathMap("math", {}));
    expect(math.width).toBe(SIZE.label + 5 * SIZE.col + 4 * SIZE.gapX);
    const cs = layoutMap(pathMap("cs", {}));
    expect(cs.width).toBe(4 * SIZE.col + 3 * SIZE.gapX);
    expect(cs.cells[0].x).toBe(0);
  });

  it("drops lane labels and narrows columns on phones", () => {
    const science = layoutMap(pathMap("science", {}), COMPACT);
    expect(science.labelWidth).toBe(0);
    expect(science.width).toBe(3 * COMPACT.col + 2 * COMPACT.gapX);
    expect(science.width).toBeLessThan(layoutMap(pathMap("science", {})).width);
  });

  it("lays a spanning cell's classes side by side under its columns", () => {
    const out = layoutMap(pathMap("math", {}));
    const electives = out.cells.find((c) => c.id === "electives")!;
    expect(electives.w).toBe(2 * SIZE.col + SIZE.gapX);
    const xs = new Set(electives.tiles.map((t) => t.x));
    expect(xs.size).toBe(2);
  });

  it("puts a caption above its classes and aims arrows at the classes, not the caption", () => {
    const out = layoutMap(pathMap("math", {}));
    const electives = out.cells.find((c) => c.id === "electives")!;
    expect(electives.note).toBe("Electives, 11th or 12th grade");
    expect(Math.min(...electives.tiles.map((t) => t.y))).toBe(electives.y + SIZE.note);
    const tilesBottom = Math.max(...electives.tiles.map((t) => t.y + t.h));
    expect(electives.mid).toBe((electives.y + SIZE.note + tilesBottom) / 2);
    const flat = out.arrows.find((a) => a.from === "a2" && a.to === "electives")!;
    expect(flat.y2).toBe(electives.mid);
  });
});
