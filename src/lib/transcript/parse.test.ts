import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTranscript, type TextItem } from "./parse";
import { toItems } from "./pdf";

async function load(file: string): Promise<TextItem[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path.resolve("fixtures", file))), useSystemFonts: true }).promise;
  return toItems(await (await doc.getPage(1)).getTextContent());
}

describe("parseTranscript on the synthetic fixture", () => {
  it("finds the class year and the three used year blocks, skipping the empty one", async () => {
    const t = parseTranscript(await load("transcript.pdf"));
    expect(t.classOf).toBe(2030);
    expect(t.blocks.map((b) => [b.gradeLevel, b.schoolYear])).toEqual([[9, "2024-25"], [10, "2025-26"], [11, "2026-27"]]);
  });

  it("reads rows with titles, final grades and credits", async () => {
    const [nine, ten] = parseTranscript(await load("transcript.pdf")).blocks;
    expect(nine.rows).toHaveLength(8);
    expect(nine.rows[0]).toEqual({ title: "English I", grade: "A", credits: 5, inProgress: false });
    expect(nine.rows[4]).toEqual({ title: "Honors Biology", grade: "B+", credits: 6, inProgress: false });
    expect(ten.rows.find((r) => r.title === "Honors United States History I")).toMatchObject({ grade: "A-", credits: 5 });
  });

  it("keeps a title that ends in a letter apart from its grade", async () => {
    const ten = parseTranscript(await load("transcript.pdf")).blocks[1];
    expect(ten.rows.find((r) => r.title.startsWith("AP Computer Science"))).toEqual({ title: "AP Computer Science A", grade: "A", credits: 5, inProgress: false });
  });

  it("treats rows with no grade or credits as in progress", async () => {
    const eleven = parseTranscript(await load("transcript.pdf")).blocks[2];
    expect(eleven.rows).toHaveLength(8);
    expect(eleven.rows.every((r) => r.inProgress && r.grade === null && r.credits === null)).toBe(true);
    expect(eleven.rows.map((r) => r.title)).toContain("Hon Eng III Class/Contemp Lit");
  });

  it("is clean when the totals agree", async () => {
    const t = parseTranscript(await load("transcript.pdf"));
    expect(t.warnings).toEqual([]);
    expect(t.blocks.map((b) => b.printedCredits)).toEqual([41, 41, 0]);
    expect(t.printedCumulativeCredits).toBe(82);
  });

  it("warns, without throwing, on a block and cumulative mismatch", async () => {
    const t = parseTranscript(await load("transcript-mismatch.pdf"));
    expect(t.warnings).toHaveLength(2);
    expect(t.warnings[0]).toContain("Grade 10");
    expect(t.warnings[1]).toContain("transcript total");
    expect(t.blocks).toHaveLength(3);
  });

  it("never carries student identity in its output", async () => {
    const t = parseTranscript(await load("transcript.pdf"));
    const dump = JSON.stringify(t);
    for (const pii of ["Sample Student", "100200", "1234567890", "01/01/2011", "Example Road", "Pat Sample", "Counselor"]) {
      expect(dump).not.toContain(pii);
    }
    expect(Object.keys(t).sort()).toEqual(["blocks", "classOf", "printedCumulativeCredits", "warnings"]);
    expect(Object.keys(t.blocks[0]).sort()).toEqual(["gradeLevel", "printedCredits", "rows", "schoolYear"]);
    expect(Object.keys(t.blocks[0].rows[0]).sort()).toEqual(["credits", "grade", "inProgress", "title"]);
  });
});

describe("parseTranscript edge cases", () => {
  const item = (str: string, x: number, y: number): TextItem => ({ str, x, y, width: str.length * 4.5 });

  it("warns on a layout it does not know", () => {
    const t = parseTranscript([item("Hello", 10, 700), item("Student Name:", 10, 600)]);
    expect(t.blocks).toEqual([]);
    expect(t.warnings[0]).toContain("could not find any year blocks");
  });

  it("accepts the unlabeled header form from the spec", () => {
    const items = [item("09 2024-25", 40, 590), item("Course Title", 40, 570), item("Algebra I B 5.000", 40, 546)];
    const t = parseTranscript(items);
    expect(t.blocks[0]).toMatchObject({ gradeLevel: 9, schoolYear: "2024-25" });
    expect(t.blocks[0].rows[0]).toMatchObject({ title: "Algebra I", grade: "B", credits: 5 });
  });

  it("handles P and W style grades and a decimal credit", () => {
    const items = [item("Grade: 12", 40, 590), item("Year: 2026-27", 90, 590), item("Course Title", 40, 570), item("Library Aide P 2.500", 40, 546)];
    expect(parseTranscript(items).blocks[0].rows[0]).toEqual({ title: "Library Aide", grade: "P", credits: 2.5, inProgress: false });
  });
});
