/**
 * Writes synthetic transcripts to fixtures/. Fake student, fake IDs, same 2 by 2 year block layout as a
 * real district transcript. Never put a real transcript in the repo. Run: npx tsx scripts/make-fixture-transcript.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

type Row = [title: string, grade?: string, credits?: string];
interface Block {
  grade: string;
  year: string;
  rows: Row[];
  gpa?: string;
  total?: string;
}

const esc = (s: string) => s.replace(/[\\()]/g, "\\$&");

function pdf(texts: { x: number; y: number; s: string; bold?: boolean }[]): Buffer {
  const content = texts.map((t) => `BT /${t.bold ? "F2" : "F1"} 8 Tf ${t.x} ${t.y} Td (${esc(t.s)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function build(blocks: Block[], opts: { cumulative: string }) {
  const t: { x: number; y: number; s: string; bold?: boolean }[] = [];
  const add = (x: number, y: number, s: string, bold = false) => t.push({ x, y, s, bold });

  // Fake student information. The parser must ignore all of this.
  add(36, 740, "Student Name:");
  add(36, 730, "Sample Student");
  add(36, 715, "Student ID:");
  add(36, 705, "100200");
  add(36, 690, "State ID:");
  add(36, 680, "1234567890");
  add(36, 665, "Date of Birth:");
  add(36, 655, "01/01/2011");
  add(36, 640, "Parent/Guardian:");
  add(36, 630, "Pat Sample, 1 Example Road, Nowhere NJ 00000");
  add(36, 611, "Class of:");
  add(73, 611, "2030");
  add(234, 611, "School Counselor:");
  add(320, 611, "Counselor, Sample");

  const spots = [
    { x: 40, top: 590 },
    { x: 335, top: 590 },
    { x: 40, top: 351 },
    { x: 335, top: 351 },
  ];
  const right = (n: number) => n >= 2 && n % 2 === 1;
  blocks.forEach((b, n) => {
    const { x, top } = spots[n];
    add(x + 2, top, "Grade:", true);
    if (b.grade) add(x + 31, top, b.grade);
    add(x + 54, top, "Year:", true);
    if (b.year) add(x + 80, top, b.year);
    const cols = right(n) ? { g: x + 157, c: x + 208 } : { g: x + 165, c: x + 206 };
    add(x + 19, top - 21, "Course Title", true);
    add(cols.g + 5, top - 21, "Final", true);
    add(cols.c + 3, top - 21, "Credits", true);
    b.rows.forEach(([title, grade, credits], i) => {
      const y = top - 44 - i * 8;
      add(x, y, title);
      if (grade) add(cols.g, y, grade);
      if (credits) add(cols.c, y, credits);
    });
    const ty = top === 590 ? 361 : 122;
    add(x + 2, ty, "Academic G.P.A.:", true);
    if (b.gpa) add(x + 75, ty, b.gpa);
    add(x + 147, ty, "Total Credits:", true);
    if (b.total) add(x + 207, ty, b.total);
  });
  add(42, 107, "Cumulative Weighted GPA:", true);
  add(169, 107, "3.90");
  add(42, 86, "Total Credits:", true);
  add(111, 85, opts.cumulative);
  add(36, 30, "This is an unofficial Transcript.");
  return pdf(t);
}

const base: Block[] = [
  {
    grade: "09", year: "2024-25", gpa: "3.80", total: "41.000",
    rows: [
      ["English I", "A", "5.000"], ["Geometry Enhanced", "B+", "5.000"], ["Honors Computer Science", "A", "5.000"],
      ["Physical Education/Health 9", "A", "5.000"], ["Honors Biology", "B+", "6.000"], ["World History", "A+", "5.000"],
      ["Video Production", "A", "5.000"], ["Spanish II", "A", "5.000"],
    ],
  },
  {
    grade: "10", year: "2025-26", gpa: "3.90", total: "41.000",
    rows: [
      ["Honors English II", "B+", "5.000"], ["Algebra II with Trigonometry Enhanced", "B+", "5.000"], ["AP Computer Science A", "A", "5.000"],
      ["Physical Education/Driver Ed 10", "A", "5.000"], ["Honors Chemistry", "B", "6.000"], ["Honors United States History I", "A-", "5.000"],
      ["Graphic Design I", "A+", "5.000"], ["Spanish III", "A-", "5.000"],
    ],
  },
  {
    grade: "11", year: "2026-27", total: "0.000",
    rows: [
      ["Financial Literacy"], ["Hon Eng III Class/Contemp Lit"], ["Pre-Calculus"], ["AP Statistics"],
      ["Advanced Topics in Computer Science (H)"], ["Physical Education/Health 11"], ["Honors Physics"], ["Some Course Nobody Mapped"],
    ],
  },
  { grade: "", year: "", rows: [] },
];

mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/transcript.pdf", build(base, { cumulative: "82.000" }));
// A deliberate mismatch: the 10th grade block claims 47 credits and the cumulative total is off too.
const bad = structuredClone(base);
bad[1].total = "47.000";
writeFileSync("fixtures/transcript-mismatch.pdf", build(bad, { cumulative: "88.000" }));
console.log("wrote fixtures/transcript.pdf and fixtures/transcript-mismatch.pdf");
