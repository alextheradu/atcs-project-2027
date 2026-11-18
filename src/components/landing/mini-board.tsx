/** A made-up board for the landing page: filled tiles are classes, outlined ones are what is still needed. */
const ROWS = [
  { key: "english", label: "English", cells: ["English I", "English II", "English III", "gap"] },
  { key: "math", label: "Math", cells: ["Geometry", "Algebra II", "Pre-Calculus", null] },
  { key: "science", label: "Science", cells: ["Biology", "Chemistry", "gap", null] },
  { key: "social", label: "Social studies", cells: ["World History", "US History I", "US History II", null] },
  { key: "language", label: "World language", cells: ["Spanish I", "Spanish II", null, null] },
  { key: "pe", label: "PE and Health", cells: ["PE 9", "PE 10", "gap", "gap"] },
];

export function MiniBoard() {
  return (
    <div className="soft min-w-0 p-3 sm:p-6">
      <table aria-describedby="example-board-note" className="w-full table-fixed border-separate border-spacing-1 text-left text-[11px] leading-tight sm:border-spacing-1.5 sm:text-xs">
        <caption className="eyebrow mb-3 px-1 text-left">Example Board</caption>
        <colgroup>
          <col className="w-[21%] sm:w-[22%]" />
          <col span={4} />
        </colgroup>
        <thead>
          <tr>
            <td />
            {["9th", "10th", "11th", "12th"].map((grade) => (
              <th key={grade} scope="col" className="num px-1 pb-1 font-semibold sm:px-2">{grade}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label, cells }) => (
            <tr key={key} className={`subject-${key}`}>
              <th scope="row" className="h-10 px-0.5 font-semibold wrap-break-word sm:h-12 sm:px-1">{label}</th>
              {cells.map((cell, index) =>
                cell === "gap" ? (
                  <td key={index} className="tile-empty table-cell w-auto px-0.5 py-1 text-[11px] sm:px-2 sm:text-xs">Needed</td>
                ) : cell ? (
                  <td key={index} className="rounded-[8px] bg-(--tile-fill) px-0.5 py-1 font-medium wrap-break-word sm:px-2">{cell}</td>
                ) : (
                  <td key={index} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p id="example-board-note" className="mt-3 px-1 text-sm text-muted">
        Each outline marks a class this sample plan still needs.
      </p>
    </div>
  );
}
