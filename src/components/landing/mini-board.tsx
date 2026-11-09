import { cn } from "@/lib/utils";

/** A made-up board for the landing page: filled tiles are classes, outlined ones are what is still needed. */
const ROWS: { key: string; label: string; cells: (string | null | "gap")[] }[] = [
  { key: "english", label: "English", cells: ["English I", "English II", "English III", "gap"] },
  { key: "math", label: "Math", cells: ["Geometry", "Algebra II", "Pre-Calculus", null] },
  { key: "science", label: "Science", cells: ["Biology", "Chemistry", "gap", null] },
  { key: "social", label: "Social studies", cells: ["World History", "US History I", "US History II", null] },
  { key: "language", label: "World language", cells: ["Spanish I", "Spanish II", null, null] },
  { key: "pe", label: "PE and Health", cells: ["PE 9", "PE 10", "gap", "gap"] },
];

export function MiniBoard() {
  return (
    <figure aria-label="An example board, made up" className="soft p-4 sm:p-5">
      <div aria-hidden className="grid grid-cols-[88px_repeat(4,minmax(0,1fr))] gap-1.5 text-[11px] sm:grid-cols-[104px_repeat(4,minmax(0,1fr))] sm:text-[12px]">
        <span />
        {["9th", "10th", "11th", "12th"].map((g) => <span key={g} className="px-1 pb-1 text-[12px] font-bold">{g}</span>)}
        {ROWS.map((r) => (
          <div key={r.key} className={cn("contents", `subject-${r.key}`)}>
            <span className="ink flex items-center truncate text-[12px] font-bold">{r.label}</span>
            {r.cells.map((c, i) =>
              c === "gap" ? (
                <span key={i} className="flex h-8 items-center truncate rounded-[8px] px-2 text-muted shadow-[inset_0_0_0_1.5px_var(--line-strong)]">+ Pick</span>
              ) : c ? (
                <span key={i} className="flex h-8 items-center truncate rounded-[8px] bg-[var(--tile-fill)] px-2 font-medium">{c}</span>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        ))}
      </div>
      <figcaption className="mt-4 text-[13px] text-muted">Example board, made up. 4 empty spots left to graduate.</figcaption>
    </figure>
  );
}
