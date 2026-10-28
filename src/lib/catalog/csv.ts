/** Catalog CSV import and export. Pure, no framework imports. Rules (JSON) are not exported. */
import type { CourseInput } from "./schemas";

export const CSV_COLUMNS = [
  "slug", "name", "department", "level", "duration", "credits", "gradesOffered", "description",
  "prereqText", "dualEnrollmentNote", "hasApExam", "plannable", "archived", "sourcePage",
  "requirements", "interests",
] as const;

export interface CourseRecord extends CourseInput {
  archived: boolean;
}

const FORMULA = /^[=+\-@\t\r]/;

function escapeCell(value: string): string {
  // A leading apostrophe stops spreadsheets from running a cell as a formula.
  const safe = FORMULA.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function serializeCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Minimal RFC 4180 parser: quoted cells, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(/^'[=+\-@\t\r]/.test(cell) ? cell.slice(1) : cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endCell();
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    endCell();
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function courseToRow(c: CourseRecord): string[] {
  return [
    c.slug, c.name, c.department, c.level, c.duration, String(c.credits), c.gradesOffered.join("|"),
    c.description, c.prereqText ?? "", c.dualEnrollmentNote ?? "", String(c.hasApExam), String(c.plannable),
    String(c.archived), c.sourcePage === null ? "" : String(c.sourcePage),
    c.requirements.map((r) => `${r.kind}:${r.credits}:${r.provisional}`).join("|"),
    c.interests.join("|"),
  ];
}

type Result = { ok: true; value: CourseRecord } | { ok: false; error: string };

const bool = (s: string) => s.trim().toLowerCase() === "true";
const list = (s: string) => (s.trim() === "" ? [] : s.split("|").map((x) => x.trim()));

/** Converts one CSV row into course input. Enum and range validation happens later in the zod schema. */
export function rowToCourseInput(header: string[], row: string[]): Result {
  for (const col of CSV_COLUMNS) {
    if (!header.includes(col)) return { ok: false, error: `Missing column: ${col}` };
  }
  const cell = (name: (typeof CSV_COLUMNS)[number]) => row[header.indexOf(name)] ?? "";

  const credits = Number(cell("credits"));
  if (!Number.isFinite(credits)) return { ok: false, error: `credits is not a number: ${cell("credits")}` };

  const grades = list(cell("gradesOffered")).map(Number);
  if (grades.some((g) => !Number.isInteger(g))) return { ok: false, error: `gradesOffered is not a list of numbers` };

  const sp = cell("sourcePage").trim();
  const sourcePage = sp === "" ? null : Number(sp);
  if (sourcePage !== null && !Number.isInteger(sourcePage)) return { ok: false, error: `sourcePage is not a number` };

  const requirements: CourseRecord["requirements"] = [];
  for (const part of list(cell("requirements"))) {
    const m = part.match(/^([A-Z_]+):(\d+(?:\.\d+)?):(true|false)$/);
    if (!m) return { ok: false, error: `Bad requirement tag: ${part}` };
    requirements.push({ kind: m[1] as never, credits: Number(m[2]), provisional: m[3] === "true" });
  }

  return {
    ok: true,
    value: {
      slug: cell("slug").trim(),
      name: cell("name").trim(),
      department: cell("department").trim() as never,
      level: cell("level").trim() as never,
      duration: cell("duration").trim() as never,
      credits,
      gradesOffered: grades,
      description: cell("description"),
      prereqText: cell("prereqText").trim() === "" ? null : cell("prereqText"),
      dualEnrollmentNote: cell("dualEnrollmentNote").trim() === "" ? null : cell("dualEnrollmentNote"),
      hasApExam: bool(cell("hasApExam")),
      plannable: bool(cell("plannable")),
      archived: bool(cell("archived")),
      sourcePage,
      requirements,
      interests: list(cell("interests")),
    },
  };
}
