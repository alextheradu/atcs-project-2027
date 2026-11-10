"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVEL_LABEL } from "@/lib/catalog/labels";
import type { MapLayout, PlacedArrow } from "@/lib/pathways/layout";
import type { MapClass, MapStatus } from "@/lib/pathways/load";
import type { MoveKind } from "@/lib/pathways/maps";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<MapStatus, string> = { COMPLETED: "Done", IN_PROGRESS: "Taking now", PLANNED: "In your plan" };
const MOVE_TEXT: Record<MoveKind, string> = { next: "next", up: "move up a level to", down: "move down a level to" };

type Shared = { title: string; classes: Record<string, MapClass>; status: Record<string, MapStatus> };

/**
 * One subject's map: tiles on a fixed grid with one SVG of arrows behind them. Pointing at or focusing a class
 * lights up the arrows into and out of it, so a busy map like math reads one class at a time. Phones get the
 * compact layout, which scrolls sideways.
 */
export function PathMap({ wide, compact, ...shared }: Shared & { wide: MapLayout; compact: MapLayout }) {
  const [active, setActive] = useState<string | null>(null);
  const { title, classes } = shared;
  const names = (cellId: string) => wide.cells.find((c) => c.id === cellId)?.tiles.map((t) => classes[t.slug]?.name).filter(Boolean).join(" or ") ?? "";

  return (
    <>
      <div className="hidden md:block">
        <Diagram id="wide" layout={wide} active={active} setActive={setActive} {...shared} />
      </div>
      <div className="md:hidden">
        <p className="mb-3 text-[13px] text-muted">Swipe sideways to see later years.</p>
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <Diagram id="compact" layout={compact} active={active} setActive={setActive} {...shared} />
        </div>
      </div>

      <ul className="sr-only" aria-label={`Moves in ${title}`}>
        {wide.cells.map((cell) => {
          const out = wide.arrows.filter((a) => a.from === cell.id);
          if (out.length === 0) return null;
          return <li key={cell.id}>From {names(cell.id)}: {out.map((a) => `${MOVE_TEXT[a.kind]} ${names(a.to)}`).join("; ")}.</li>;
        })}
      </ul>
    </>
  );
}

function Diagram({ id, layout, active, setActive, title, classes, status }: Shared & { id: string; layout: MapLayout; active: string | null; setActive: (cell: string | null) => void }) {
  const lit = (a: PlacedArrow) => a.from === active || a.to === active;
  const linked = new Set(active ? layout.arrows.filter(lit).flatMap((a) => [a.from, a.to]) : []);
  const head = `${id}-head`;

  return (
    <div role="group" aria-label={title} className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg aria-hidden width={layout.width} height={layout.height} className="absolute inset-0">
        <defs>
          <marker id={head} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L8 4L0 8z" className="fill-muted" />
          </marker>
          <marker id={`${head}-lit`} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L8 4L0 8z" className="fill-fg" />
          </marker>
        </defs>
        {layout.arrows.map((a) => {
          const on = active !== null && lit(a);
          return (
            <path
              key={`${a.from}-${a.to}`}
              d={a.d}
              fill="none"
              strokeWidth={on ? 2 : 1.5}
              strokeDasharray={a.kind === "next" ? undefined : "5 4"}
              markerEnd={`url(#${on ? `${head}-lit` : head})`}
              className={cn("transition-opacity duration-150", on ? "stroke-fg" : "stroke-muted", active !== null && !on && "opacity-20")}
            />
          );
        })}
      </svg>

      {layout.columns.map((c) => (
        <p key={c.label} className="absolute text-[13px] font-medium text-muted" style={{ left: c.x, top: 0, width: c.w }}>
          {c.label}
        </p>
      ))}
      {layout.labelWidth > 0 &&
        layout.lanes.map((l) => (
          <p key={l.label} className="absolute flex items-center pr-4 text-[13px] font-medium leading-snug text-muted" style={{ left: 0, top: l.y, width: layout.labelWidth, height: l.h }}>
            {l.label}
          </p>
        ))}
      {layout.cells.map(
        (cell) =>
          cell.note && (
            <p key={`${cell.id}-note`} className="absolute truncate text-[12px] font-medium text-muted" style={{ left: cell.x, top: cell.y, width: cell.w }}>
              {cell.note}
            </p>
          ),
      )}

      {layout.cells.flatMap((cell) =>
        cell.tiles.map((t) => {
          const c = classes[t.slug];
          if (!c) return null;
          const s = status[t.slug];
          const level = LEVEL_LABEL[c.level] ?? c.level;
          return (
            <Link
              key={t.slug}
              href={`/courses/${t.slug}`}
              title={c.name}
              aria-label={`${c.name}, ${level}${s ? `, ${STATUS_TEXT[s].toLowerCase()}` : ""}`}
              onMouseEnter={() => setActive(cell.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(cell.id)}
              onBlur={() => setActive(null)}
              className={cn(
                "tile absolute flex flex-col justify-center transition-[opacity,transform] duration-150 motion-safe:hover:-translate-y-px",
                `subject-${c.row}`,
                active !== null && !linked.has(cell.id) && "opacity-50",
              )}
              style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
            >
              <span className="line-clamp-2 font-medium leading-[1.25]">{c.name}</span>
              <span className="ink mt-0.5 flex gap-x-2 truncate text-[12px] font-medium">
                <span>{level}</span>
                {s && <span className="text-fg">{STATUS_TEXT[s]}</span>}
              </span>
            </Link>
          );
        }),
      )}
    </div>
  );
}
