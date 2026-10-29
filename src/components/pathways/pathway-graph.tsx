"use client";

import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Background, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { StartAppealButton } from "@/components/appeals/start-button";
import { Breakdown } from "@/components/eligibility/breakdown";
import { DEPT_LABEL, LEVEL_LABEL } from "@/lib/catalog/labels";
import { KIND_LABEL, TRACKS, TRACK_LABEL, type NodeKind, type Track } from "@/lib/pathways";
import type { PathEdge, PathNode } from "@/lib/pathways/load";
import { cn } from "@/lib/utils";

const W = 156;
const H = 46;

const DOT: Record<NodeKind, string> = {
  completed: "bg-green",
  planned: "bg-accent",
  open: "bg-fg",
  appeal: "bg-orange",
  locked: "bg-muted/50",
  none: "bg-muted/40",
};

type CourseData = { node: PathNode; selected: boolean };

function CourseNode({ data }: NodeProps<Node<CourseData>>) {
  const { node, selected } = data;
  return (
    <div
      className={cn(
        "flex h-[46px] w-[156px] items-center gap-2 rounded-md border bg-raised px-2.5 text-left transition-colors duration-150",
        node.kind === "appeal" ? "border-dashed border-orange/70" : "border-line-strong",
        node.kind === "locked" && "opacity-60",
        selected && "border-accent bg-elevated",
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1 !border-0 !bg-line-strong" />
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[node.kind])} />
      <span className="min-w-0">
        <span className="line-clamp-2 text-[12px] font-medium leading-[1.2]">{node.name}</span>
        <span className="num mt-0.5 block truncate text-[10.5px] text-muted">
          {LEVEL_LABEL[node.level]} · gr {node.gradesOffered.join(" ") || "8"}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} className="!size-1 !border-0 !bg-line-strong" />
    </div>
  );
}

const nodeTypes = { course: CourseNode };

function layout(nodes: PathNode[], edges: PathEdge[], selected: string | null): { nodes: Node<CourseData>[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 16, ranksep: 38, marginx: 8, marginy: 8 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: W, height: H });
  for (const e of edges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return { id: n.id, type: "course", position: { x: p.x - W / 2, y: p.y - H / 2 }, data: { node: n, selected: n.id === selected }, draggable: false };
    }),
    edges: edges.map((e) => {
      const to = byId.get(e.to)!;
      const advance = e.kind === "ADVANCE";
      const dim = to.kind === "locked";
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: dim ? "#3a3a3a" : "#7a7a7a" },
        style: { stroke: dim ? "#3a3a3a" : "#7a7a7a", strokeWidth: 1.25, strokeDasharray: advance ? "5 4" : undefined },
      };
    }),
  };
}

const LANGUAGES = ["spanish", "french", "italian", "chinese"] as const;

const LEGEND: { kind: NodeKind; text: string }[] = [
  { kind: "completed", text: "Completed" },
  { kind: "planned", text: "In your plan" },
  { kind: "open", text: "Open to you" },
  { kind: "appeal", text: "Needs an appeal" },
  { kind: "locked", text: "Locked" },
];

export function PathwayGraph({ nodes, edges, hasPlan }: { nodes: PathNode[]; edges: PathEdge[]; hasPlan: boolean }) {
  const [track, setTrack] = useState<Track>("MATH");
  const [selected, setSelected] = useState<string | null>(null);
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("spanish");

  const view = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // World language has four separate ladders. Show one at a time.
    const es = edges.filter((e) => e.track === track && (track !== "WORLD_LANGUAGE" || byId.get(e.from)?.slug.includes(language)));
    const ids = new Set(es.flatMap((e) => [e.from, e.to]));
    return layout(nodes.filter((n) => ids.has(n.id)), es, selected);
  }, [nodes, edges, track, language, selected]);

  const node = nodes.find((n) => n.id === selected) ?? null;
  const incoming = node ? edges.filter((e) => e.to === node.id && e.track === track) : [];
  const advanceOnly = incoming.length > 0 && incoming.every((e) => e.kind === "ADVANCE");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div role="tablist" aria-label="Pathway" className="mb-4 flex flex-wrap gap-x-5 gap-y-1 border-b border-line">
          {TRACKS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === track}
              onClick={() => {
                setTrack(t);
                setSelected(null);
              }}
              className={cn(
                "-mb-px border-b py-2 text-[13px] transition-colors",
                t === track ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {TRACK_LABEL[t]}
            </button>
          ))}
        </div>

        {track === "WORLD_LANGUAGE" && (
          <div role="group" aria-label="Language" className="mb-3 flex gap-4 text-[13px]">
            {LANGUAGES.map((l) => (
              <button key={l} type="button" aria-pressed={l === language} onClick={() => { setLanguage(l); setSelected(null); }} className={cn("capitalize transition-colors", l === language ? "text-fg" : "text-muted hover:text-fg")}>
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="h-[640px] overflow-hidden rounded-md border border-line bg-bg" aria-label={`${TRACK_LABEL[track]} pathway graph`}>
          <ReactFlow
            key={`${track}-${language}`}
            nodes={view.nodes}
            edges={view.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.02, minZoom: 0.8 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.3}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, n) => setSelected(n.id)}
            onPaneClick={() => setSelected(null)}
          >
            <Background gap={24} size={1} color="#1f1f1f" />
          </ReactFlow>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
          {hasPlan ? (
            LEGEND.map((l) => (
              <span key={l.kind} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-1.5 rounded-full", DOT[l.kind])} />
                {l.text}
              </span>
            ))
          ) : (
            <span>Create a plan to see which steps are open to you.</span>
          )}
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="#7a7a7a" strokeWidth="1.25" strokeDasharray="5 4" /></svg>
            Moves up a level
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">Click a course to see what it takes. Drag to pan, scroll to zoom.</p>
      </div>

      <aside aria-live="polite" className="lg:sticky lg:top-20 lg:self-start">
        {node ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-[15px] font-medium leading-snug">{node.name}</h2>
              <p className="num mt-1 text-xs text-muted">
                {DEPT_LABEL[node.department]} · {LEVEL_LABEL[node.level]} · grade {node.gradesOffered.join(", ") || "8"}
              </p>
              {KIND_LABEL[node.kind] && <p className="mt-2 flex items-center gap-1.5 text-[13px]"><span aria-hidden className={cn("size-1.5 rounded-full", DOT[node.kind])} />{KIND_LABEL[node.kind]}{node.grade ? `, fits best in grade ${node.grade}` : ""}</p>}
            </div>
            {node.tree ? (
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted">What it takes</h3>
                <Breakdown tree={node.tree} />
              </div>
            ) : node.prereqText ? (
              <p className="text-[13px] text-muted">{node.prereqText}</p>
            ) : (
              <p className="text-[13px] text-muted">No prerequisites listed.</p>
            )}
            {advanceOnly && <p className="text-xs text-muted">This is a move up a level, so a supervisor may need to approve it.</p>}
            <div className="flex items-center gap-3">
              {node.kind === "appeal" && (
                <StartAppealButton slug={node.slug} />
              )}
              <Link href={`/courses/${node.slug}`} className="text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">
                View course
              </Link>
            </div>
            {node.kind === "locked" && <p className="text-xs text-muted">Finish the earlier course in the sequence first. A locked course cannot be appealed.</p>}
          </div>
        ) : (
          <p className="text-[13px] text-muted">Select a course to see its requirements.</p>
        )}
      </aside>

      <ul className="sr-only" aria-label="Courses in this pathway">
        {view.nodes.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => setSelected(n.id)}>{n.data.node.name}{KIND_LABEL[n.data.node.kind] ? `, ${KIND_LABEL[n.data.node.kind]}` : ""}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
