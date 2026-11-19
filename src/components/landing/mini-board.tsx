/** A made-up board for the landing page: filled tiles are classes, outlined ones are what is still needed. */
import { cn } from "@/lib/utils";

const ROWS = [
  { key: "english", label: "English", cells: ["English I", "English II", "English III", "gap"] },
  { key: "math", label: "Math", cells: ["Geometry", "Algebra II", "Pre-Calculus", null] },
  { key: "science", label: "Science", cells: ["Biology", "Chemistry", "gap", null] },
  { key: "social", label: "Social studies", cells: ["World History", "US History I", "US History II", null] },
  { key: "language", label: "World language", cells: ["Spanish I", "Spanish II", null, null] },
  { key: "pe", label: "PE and Health", cells: ["PE 9", "PE 10", "gap", "gap"] },
  { key: "arts", label: "Arts", cells: ["Drawing I", null, null, null] },
];

export function MiniBoard() {
  return (
    <figure aria-label="An example four-year plan, made up" className="soft p-4 sm:p-6">
      <div aria-hidden className="grid grid-cols-[90px_repeat(4,minmax(0,1fr))] gap-1.5 sm:grid-cols-[112px_repeat(4,minmax(0,1fr))]">
        {/* Column headers */}
        <span />
        {["9th", "10th", "11th", "12th"].map((g) => (
          <span key={g} className="pb-2 pl-1 text-[12px] font-bold text-muted">
            {g}
          </span>
        ))}

        {/* Rows */}
        {ROWS.map((r) => (
          <div key={r.key} className={cn("contents", `subject-${r.key}`)}>
            <span className="ink flex items-center truncate pr-2 text-[12px] font-bold">{r.label}</span>
            {r.cells.map((c, i) =>
              c === "gap" ? (
                <span
                  key={i}
                  className="flex h-9 items-center truncate rounded-[8px] px-2 text-[11px] text-muted shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
                >
                  + Pick
                </span>
              ) : c ? (
                <span
                  key={i}
                  className="flex h-9 items-center truncate rounded-[8px] bg-[var(--tile-fill)] px-2 text-[12px] font-medium"
                >
                  {c}
                </span>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        ))}
      </div>

      <figcaption className="mt-4 text-[13px] text-muted">
        Example board, made up. 5 empty spots left to graduate.
      </figcaption>
    </figure>
  );
}
