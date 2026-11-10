/**
 * Places a pathway map on a fixed grid: a column per year, a lane per level, and an arrow in the gap
 * between columns for each move. Plain numbers in pixels, so the page can position tiles and draw one
 * SVG behind them without measuring anything. Pure.
 */
import type { MoveKind, PathMap } from "./maps";

export interface Sizes {
  /** Lane labels on the left. 0 drops them; they are also dropped when a map has one unnamed lane. */
  label: number;
  col: number;
  /** Space between columns, where the arrows run. */
  gapX: number;
  tile: number;
  /** Space between classes stacked in one cell. */
  stack: number;
  /** Room for a cell's caption above its classes. */
  note: number;
  laneGap: number;
  /** Column labels on top. */
  header: number;
  /** How far a bending arrow starts above or below the middle of its cell. */
  bend: number;
}

export const SIZE: Sizes = { label: 96, col: 168, gapX: 52, tile: 68, stack: 6, note: 22, laneGap: 24, header: 32, bend: 10 };

/** Phones: every tile already names its level, so the lane labels go and the columns narrow. */
export const COMPACT: Sizes = { ...SIZE, label: 0, col: 148, gapX: 36 };

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedTile extends Rect { slug: string }
export interface PlacedCell extends Rect {
  id: string;
  note: string | null;
  /** Where arrows meet the cell: the middle of its classes, below any caption. */
  mid: number;
  tiles: PlacedTile[];
}
export interface PlacedArrow {
  from: string;
  to: string;
  kind: MoveKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** SVG path. Flat when both ends are level, otherwise an S curve that leaves and arrives horizontally. */
  d: string;
}
export interface MapLayout {
  width: number;
  height: number;
  labelWidth: number;
  columns: { label: string; x: number; w: number }[];
  lanes: { label: string; y: number; h: number }[];
  cells: PlacedCell[];
  arrows: PlacedArrow[];
}

export function layoutMap(map: PathMap, s: Sizes = SIZE): MapLayout {
  const labelWidth = s.label > 0 && map.lanes.some((l) => l !== "") ? s.label : 0;
  const colX = (c: number) => labelWidth + c * (s.col + s.gapX);

  const sized = map.cells.map((cell) => {
    const span = cell.span ?? 1;
    const rows = Math.ceil(cell.slugs.length / span);
    const noteH = cell.note ? s.note : 0;
    const tilesH = rows * s.tile + (rows - 1) * s.stack;
    return { cell, span, noteH, tilesH, w: span * s.col + (span - 1) * s.gapX, h: noteH + tilesH };
  });

  // The classes in a lane share a middle line, so the usual next step is always a flat arrow. A caption
  // sits above that, and the lane grows to fit the tallest cell on either side of the line.
  const lanes: (MapLayout["lanes"][number] & { mid: number })[] = [];
  let y = s.header;
  map.lanes.forEach((label, i) => {
    const inLane = sized.filter((s) => s.cell.lane === i);
    const above = Math.max(s.tile / 2, ...inLane.map((s) => s.noteH + s.tilesH / 2));
    const below = Math.max(s.tile / 2, ...inLane.map((s) => s.tilesH / 2));
    lanes.push({ label, y, h: above + below, mid: y + above });
    y += above + below + s.laneGap;
  });
  const lanesBottom = y - s.laneGap;

  const cells: PlacedCell[] = sized.map(({ cell, span, noteH, tilesH, w, h }) => {
    const x = colX(cell.col);
    const mid = cell.lane === "all" ? (s.header + lanesBottom) / 2 : lanes[cell.lane].mid;
    const top = mid - tilesH / 2 - noteH;
    return {
      id: cell.id,
      x,
      y: top,
      w,
      h,
      note: cell.note ?? null,
      mid,
      tiles: cell.slugs.map((slug, i) => ({
        slug,
        x: x + (i % span) * (s.col + s.gapX),
        y: top + noteH + Math.floor(i / span) * (s.tile + s.stack),
        w: s.col,
        h: s.tile,
      })),
    };
  });

  const byId = new Map(cells.map((c) => [c.id, c]));
  const arrows: PlacedArrow[] = map.moves.map((m) => {
    const from = byId.get(m.from)!;
    const to = byId.get(m.to)!;
    const fromMid = from.mid;
    const toMid = to.mid;
    // A bending arrow leaves a little toward where it is going, so it does not share a point with a flat one.
    const dir = Math.sign(toMid - fromMid);
    const off = dir === 0 ? 0 : Math.min(s.bend, from.h / 4, to.h / 4);
    const x1 = from.x + from.w;
    const x2 = to.x;
    const y1 = fromMid + dir * off;
    const y2 = toMid - dir * off;
    const mx = (x1 + x2) / 2;
    const d = y1 === y2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
    return { from: m.from, to: m.to, kind: m.kind, x1, y1, x2, y2, d };
  });

  const n = map.columns.length;
  return {
    width: labelWidth + n * s.col + (n - 1) * s.gapX,
    height: Math.max(lanesBottom, ...cells.map((c) => c.y + c.h)),
    labelWidth,
    columns: map.columns.map((label, i) => ({ label, x: colX(i), w: s.col })),
    lanes: lanes.map(({ label, y, h }) => ({ label, y, h })),
    cells,
    arrows,
  };
}
