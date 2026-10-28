/**
 * One-off extraction of course blocks from the Program of Studies text.
 * Input:  docs/source/pages/NN.txt (pdftotext -layout, one file per PDF page)
 * Output: prisma/seed/courses.draft.json (review it, then run scripts/build-catalog.ts)
 *
 * Printed page N is PDF page N + 1.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAGES_DIR = path.resolve("docs/source/pages");
const OUT = path.resolve("prisma/seed/courses.draft.json");

const DEPT_BY_HEADER: Record<string, string> = {
  "ENGLISH DEPARTMENT": "ENGLISH",
  "SOCIAL STUDIES DEPARTMENT": "SOCIAL_STUDIES",
  "MATHEMATICS DEPARTMENT": "MATH",
  "SCIENCE DEPARTMENT": "SCIENCE",
  "WORLD LANGUAGE DEPARTMENT": "WORLD_LANGUAGE",
  "ART DEPARTMENT": "ART",
  "BUSINESS EDUCATION DEPARTMENT": "BUSINESS",
  "FAMILY AND CONSUMER SCIENCES DEPARTMENT": "FAMILY_CONSUMER_SCIENCES",
  "HEALTH AND PHYSICAL EDUCATION DEPARTMENT": "HEALTH_PE",
  "MUSIC DEPARTMENT": "MUSIC",
  "TECHNOLOGY EDUCATION DEPARTMENT": "TECHNOLOGY",
  "SPECIAL EDUCATION DEPARTMENT": "SPECIAL_ED",
};

const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\*+/g, "")
    .trim()
    .toLowerCase();

const FOOTER = /Not all courses may be offered|THE ADMINISTRATION RESERVES/;

function loadPages(): { pdfPage: number; lines: string[] }[] {
  return readdirSync(PAGES_DIR)
    .filter((f) => /^\d+\.txt$/.test(f))
    .sort()
    .map((f) => ({
      pdfPage: parseInt(f, 10),
      lines: readFileSync(path.join(PAGES_DIR, f), "utf8")
        .split("\n")
        .map((l) => l.replace(/\s+$/, ""))
        .filter((l) => !FOOTER.test(l)),
    }));
}

interface TocEntry {
  dept: string | null;
  title: string;
  printedPage: number;
}

function parseToc(pages: ReturnType<typeof loadPages>): TocEntry[] {
  const entries: TocEntry[] = [];
  let dept: string | null = null;
  for (const p of pages.filter((p) => p.pdfPage >= 4 && p.pdfPage <= 8)) {
    for (const line of p.lines) {
      const m = line.match(/^(\s*)(.+?)\s*\.{3,}\s*(\d+)\s*$/);
      if (!m) continue;
      const title = m[2].trim();
      if (!m[1] && DEPT_BY_HEADER[title]) {
        dept = DEPT_BY_HEADER[title];
        continue;
      }
      entries.push({ dept: m[1] ? dept : null, title, printedPage: parseInt(m[3], 10) });
    }
  }
  return entries;
}

function main() {
  const pages = loadPages();
  const toc = parseToc(pages);

  // One stream of lines with a page marker so blocks can span pages.
  const stream: { text: string; printedPage: number }[] = [];
  for (const p of pages.filter((p) => p.pdfPage >= 9)) {
    for (const l of p.lines) stream.push({ text: l, printedPage: p.pdfPage - 1 });
  }

  // Locate each TOC title in order, searching forward from the previous hit.
  const starts: { entry: TocEntry; idx: number }[] = [];
  let cursor = 0;
  const missing: string[] = [];
  for (const entry of toc.filter((e) => e.dept)) {
    const want = norm(entry.title);
    let found = -1;
    for (let i = cursor; i < stream.length; i++) {
      if (Math.abs(stream[i].printedPage - entry.printedPage) > 1) {
        if (stream[i].printedPage > entry.printedPage + 1) break;
        continue;
      }
      const have = norm(stream[i].text);
      // A heading may wrap onto a second line (only long titles do), or carry a trailing note.
      const wrapped = have.length > 40 && want.startsWith(have);
      const trailing = have.startsWith(want) && !/[a-z0-9]/.test(have.charAt(want.length));
      if (have === want || wrapped || trailing) {
        found = i;
        break;
      }
    }
    if (found === -1) missing.push(`${entry.title} (p${entry.printedPage})`);
    else {
      starts.push({ entry, idx: found });
      cursor = found + 1;
    }
  }

  const courses = starts.map(({ entry, idx }, n) => {
    const end = n + 1 < starts.length ? starts[n + 1].idx : Math.min(stream.length, idx + 60);
    const block = stream.slice(idx + 1, end).map((l) => l.text);

    // The grade line looks like "Grades 9, 10, 11, 12" or "Grade 10 A" where "A" is the drop cap of the first paragraph.
    let grades: string | null = null;
    let dropCap = "";
    for (const l of block.slice(0, 6)) {
      const m = l.match(/\bGrades?\s+(\d+(?:\s*(?:,|&|and)\s*\d+)*)\s*([A-Za-z0-9]{0,3})\s*$/);
      if (m) {
        grades = m[1].replace(/\s+/g, " ").trim();
        dropCap = m[2];
        break;
      }
    }
    // Requirement segments sit at the top of the block, before the description paragraph.
    const START = /^(Prerequisites?|Co-?requisites?|Suggested Co-?requisites?|Placement by recommendation|Honors Course Prerequisite)\b/i;
    const consumed = new Set<number>();
    const segments: string[] = [];
    for (let i = 0; i < Math.min(block.length, 14); i++) {
      const line = block[i].trim();
      if (!START.test(line) || consumed.has(i)) continue;
      const parts = [line.replace(/\s{2,}Grades?\s+[\d,\s/&and-]+[A-Za-z0-9]{0,3}$/i, "")];
      consumed.add(i);
      for (let j = i + 1; j < Math.min(block.length, i + 8); j++) {
        const l = block[j].trim();
        if (l === "" || START.test(l) || /^Grades?\s+\d/i.test(l)) break;
        const words = l.split(/\s+/).length;
        const continues = /^[a-z(\u2018']/.test(l) || words <= 3;
        if (!continues) break;
        parts.push(l.replace(/\s{2,}Grades?\s+[\d,\s/&and-]+[A-Za-z0-9]{0,3}$/i, ""));
        consumed.add(j);
      }
      segments.push(parts.join(" ").replace(/\s{2,}/g, " ").trim());
    }
    const prereqText = segments.length ? segments.join(" ") : null;

    const bodyLines = block
      .filter((_, i) => !consumed.has(i))
      .map((l) => l.replace(/\s{3,}Grades?\s+[\d,\s/&and-]+[A-Za-z0-9]{0,3}\s*$/i, "").replace(/^\s*Grades?\s+[\d,\s/&and-]+[A-Za-z0-9]{0,3}\s*$/i, ""))
      .map((l) => l.trim())
      .filter((l) => l !== "");
    const SKIP = /^(Dual Enrollment Option|Full-year elective$|Half-year elective( - Honors)?$)/i;
    let first = 0;
    while (first < bodyLines.length && SKIP.test(bodyLines[first])) first++;
    if (dropCap && first < bodyLines.length) {
      const labeled = bodyLines[first].match(/^((?:Full|Half)-year elective(?: - Honors)?)\s+(.*)$/);
      bodyLines[first] = labeled ? `${labeled[1]} ${dropCap}${labeled[2]}` : `${dropCap}${bodyLines[first]}`;
    }
    const description = bodyLines
      .join(" ")
      .replace(/\b(\d+)ST\b/g, "$1st")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);

    const lower = block.join(" ").toLowerCase();
    return {
      dept: entry.dept,
      title: entry.title,
      sourcePage: entry.printedPage,
      grades,
      prereqText,
      cues: {
        half: /half[- ]year|semester course|one semester|2\.5 credit/.test(lower),
        credits: (lower.match(/(\d+(?:\.\d+)?)\s+credits?/) ?? [])[1] ?? null,
        dual: /seton hall|kean|william paterson|syracuse|ramapo|university of texas|dual enrollment/.test(lower),
      },
      description,
    };
  });

  // Plain text dump for human review (the shell truncates long lines, read this with the Read tool).
  const dump = courses
    .map(
      (c) =>
        `[${c.dept}] p${c.sourcePage} ${c.title}\n  grades: ${c.grades ?? "?"} | half:${c.cues.half} credits:${c.cues.credits ?? "-"} dual:${c.cues.dual}\n  prereq: ${c.prereqText ?? "-"}\n  desc: ${c.description.slice(0, 220)}\n`,
    )
    .join("\n");
  writeFileSync(path.resolve("docs/source/review.txt"), dump);

  writeFileSync(OUT, JSON.stringify({ missing, count: courses.length, courses }, null, 2) + "\n");
  console.log(`TOC entries with a department: ${toc.filter((e) => e.dept).length}`);
  console.log(`Blocks extracted: ${courses.length}`);
  console.log(`Titles not found: ${missing.length}`);
  for (const m of missing) console.log("  MISSING", m);
}

main();
