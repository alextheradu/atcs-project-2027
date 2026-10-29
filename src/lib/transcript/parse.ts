/**
 * Transcript parser. Input is pdfjs text items with positions, output is year blocks and course rows.
 * Pure, no framework imports, runs in the browser. It only ever extracts: class year, block grade level
 * and school year, course rows, and credit totals. It never reads, keeps or logs the student name,
 * birth date, student or state ID, address or parent names, and the output types have no field for them.
 */

export interface TextItem {
  str: string;
  x: number;
  y: number;
  /** Width in the same units as x. Used to decide whether two pieces touch. */
  width?: number;
}

export interface ParsedRow {
  title: string;
  /** Letter as printed, for example "B+" or "A". Null for a course still in progress. */
  grade: string | null;
  credits: number | null;
  inProgress: boolean;
}

export interface ParsedBlock {
  /** 9 to 12. */
  gradeLevel: number;
  /** For example "2024-25". */
  schoolYear: string;
  rows: ParsedRow[];
  /** Total credits printed for the block. */
  printedCredits: number | null;
}

export interface ParsedTranscript {
  classOf: number | null;
  blocks: ParsedBlock[];
  /** Cumulative total credits as printed. */
  printedCumulativeCredits: number | null;
  /** Never blocking. Shown on the review screen. */
  warnings: string[];
}

const HEADER = /^(?:Grade:?\s*)?(\d{2})\s+(?:Year:?\s*)?(\d{4})-(\d{2})$/;
const HEADER_LABELED = /^Grade:\s*(\d{2})?\s*Year:\s*(?:(\d{4})-(\d{2}))?$/;
const ROW = /^(.+?)\s+([A-DFPWI][+-]?)\s+(\d+\.\d{3})$/;
const BLOCK_TOTAL = /^Academic G\.P\.A\.:.*Total Credits:\s*(\d+\.\d{3})/;
const CUMULATIVE = /^Total Credits:\s*(\d+\.\d{3})$/;
const CLASS_OF = /^Class of:?\s*(\d{4})\b/;
const COLUMN_HEADER = /^Course Title\b/;
const MAX_TITLE = 120;
const Y_TOLERANCE = 2.5;

type Line = { y: number; text: string };

/** Group items into lines by y, then join each line left to right. */
function toLines(items: TextItem[]): Line[] {
  const sorted = items.filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_TOLERANCE) last.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => {
    const line = [...r].sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd: number | null = null;
    for (const it of line) {
      const gap = prevEnd === null ? 99 : it.x - prevEnd;
      // Pieces that touch were one word. Anything with a visible gap gets a space.
      text += (prevEnd === null || gap > 1.2 ? (text ? " " : "") : "") + it.str.trim();
      prevEnd = it.x + (it.width ?? it.str.length * 4.5);
    }
    return { y: line[0].y, text: text.replace(/\s+/g, " ").trim() };
  });
}

function parseBlock(lines: Line[]): ParsedBlock | null {
  let header: { gradeLevel: number; schoolYear: string } | null = null;
  const rows: ParsedRow[] = [];
  let printed: number | null = null;
  let inTable = false;

  for (const { text } of lines) {
    if (!header) {
      const labeled = HEADER_LABELED.exec(text);
      if (labeled) {
        if (!labeled[1] || !labeled[2]) return null; // an unused block
        header = { gradeLevel: Number(labeled[1]), schoolYear: `${labeled[2]}-${labeled[3]}` };
        continue;
      }
      const bare = HEADER.exec(text);
      if (bare) header = { gradeLevel: Number(bare[1]), schoolYear: `${bare[2]}-${bare[3]}` };
      continue;
    }
    if (COLUMN_HEADER.test(text)) {
      inTable = true;
      continue;
    }
    const total = BLOCK_TOTAL.exec(text);
    if (total) {
      printed = Number(total[1]);
      break;
    }
    if (!inTable || text.length === 0) continue;
    const m = ROW.exec(text);
    if (m) {
      if (m[1].length <= MAX_TITLE) rows.push({ title: m[1].trim(), grade: m[2], credits: Number(m[3]), inProgress: false });
    } else if (text.length <= MAX_TITLE && !CUMULATIVE.test(text) && !/GPA|G\.P\.A\./i.test(text)) {
      // A title with no grade and no credits: the course is still going.
      rows.push({ title: text, grade: null, credits: null, inProgress: true });
    }
  }
  return header ? { ...header, rows, printedCredits: printed } : null;
}

export function parseTranscript(items: TextItem[], pageWidth = 612): ParsedTranscript {
  const warnings: string[] = [];
  const mid = pageWidth / 2;
  const all = toLines(items);

  let classOf: number | null = null;
  for (const l of all) {
    const m = CLASS_OF.exec(l.text);
    if (m) {
      classOf = Number(m[1]);
      break;
    }
  }

  // The year blocks sit in a 2 by 2 grid. A "Grade:" and "Year:" pair marks each block top.
  const halves = [items.filter((it) => it.x < mid), items.filter((it) => it.x >= mid)];
  const tops = [...new Set(halves.flatMap((h) => toLines(h)).filter((l) => HEADER_LABELED.test(l.text) || HEADER.test(l.text)).map((l) => Math.round(l.y)))];
  const bandTops = tops.sort((a, b) => b - a).reduce<number[]>((acc, y) => (acc.some((t) => Math.abs(t - y) <= 6) ? acc : [...acc, y]), []);

  const blocks: ParsedBlock[] = [];
  let cumulative: number | null = null;

  bandTops.forEach((top, i) => {
    const bottom = bandTops[i + 1] ?? -Infinity;
    const band = items.filter((it) => it.y <= top + 4 && it.y > bottom + 4);
    for (const side of [band.filter((it) => it.x < mid), band.filter((it) => it.x >= mid)]) {
      const block = parseBlock(toLines(side));
      if (block) blocks.push(block);
    }
  });

  // The cumulative total is a line on its own that starts with "Total Credits:".
  for (const l of all) {
    const m = CUMULATIVE.exec(l.text);
    if (m) cumulative = Number(m[1]);
  }

  if (blocks.length === 0) warnings.push("We could not find any year blocks. This may not be a supported transcript layout.");

  let sum = 0;
  for (const b of blocks) {
    const earned = b.rows.reduce((n, r) => n + (r.credits ?? 0), 0);
    sum += earned;
    if (b.printedCredits !== null && Math.abs(earned - b.printedCredits) > 0.0005) {
      warnings.push(`Grade ${b.gradeLevel} (${b.schoolYear}): the rows add up to ${earned.toFixed(3)} but the transcript says ${b.printedCredits.toFixed(3)}. Check for a missing or misread course.`);
    }
  }
  if (cumulative !== null && blocks.length > 0 && Math.abs(sum - cumulative) > 0.0005) {
    warnings.push(`All years add up to ${sum.toFixed(3)} credits but the transcript total is ${cumulative.toFixed(3)}. Check for a missing or misread course.`);
  }

  blocks.sort((a, b) => a.gradeLevel - b.gradeLevel);
  return { classOf, blocks, printedCumulativeCredits: cumulative, warnings };
}
