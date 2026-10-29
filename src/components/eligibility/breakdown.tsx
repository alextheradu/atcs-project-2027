import type { LeafResult, NodeResult } from "@/lib/eligibility";
import { cn } from "@/lib/utils";

const DOT: Record<LeafResult["state"], string> = {
  met: "bg-green",
  pending: "bg-yellow",
  manual: "bg-yellow",
  unmet: "bg-red",
};
const WORD: Record<LeafResult["state"], string> = { met: "Met", pending: "Check", manual: "Needs approval", unmet: "Not met" };

function Leaf({ leaf }: { leaf: LeafResult }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5 text-[13px]">
      <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[leaf.state])} />
      <span className="min-w-0 flex-1">
        <span className="sr-only">{WORD[leaf.state]}: </span>
        <span className={leaf.state === "met" ? "text-muted" : "text-fg"}>{leaf.message}</span>
        {leaf.rule.note && <span className="mt-0.5 block text-xs text-muted">{leaf.rule.note}</span>}
      </span>
    </li>
  );
}

function Node({ node, depth }: { node: NodeResult; depth: number }) {
  if (node.kind === "leaf") return <Leaf leaf={node.leaf} />;
  const single = node.children.length === 1;
  if (single) return <Node node={node.children[0]} depth={depth} />;
  return (
    <li className="py-1">
      <p className="text-xs text-muted">{node.kind === "all" ? "All of these" : "Any one of these"}</p>
      <ul className={cn("mt-0.5", depth > 0 && "ml-3 border-l border-line pl-3")}>
        {node.children.map((c, i) => (
          <Node key={i} node={c} depth={depth + 1} />
        ))}
      </ul>
    </li>
  );
}

/** What a student still needs, leaf by leaf. `any` groups show the options. */
export function Breakdown({ tree }: { tree: NodeResult | null }) {
  if (!tree) return null;
  return (
    <ul aria-label="Requirements" className="list-none">
      <Node node={tree} depth={0} />
    </ul>
  );
}
