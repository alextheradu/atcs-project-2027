/**
 * Turns prisma/seed/courses.draft.json (from extract-catalog.ts) into the reviewed seed files:
 *   prisma/seed/courses.json, requirements.json, interest-tags.json, aliases.json
 *
 * This file IS the hand review. Every decision that is not in the PDF text is marked "judgment"
 * and listed at the bottom of docs/spec/14-open-items.md. Run: npx tsx scripts/build-catalog.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeTitle } from "../src/lib/catalog/normalize";

type Dept =
  | "ENGLISH" | "SOCIAL_STUDIES" | "MATH" | "COMPUTER_SCIENCE" | "SCIENCE" | "WORLD_LANGUAGE" | "ART"
  | "BUSINESS" | "FAMILY_CONSUMER_SCIENCES" | "HEALTH_PE" | "MUSIC" | "TECHNOLOGY" | "SPECIAL_ED" | "OTHER";
type Level = "CP" | "ENHANCED" | "HONORS" | "AP" | "DUAL_ENROLLMENT" | "MIDDLE_SCHOOL";
type Kind =
  | "ENGLISH" | "MATH" | "SCI_BIO" | "SCI_CHEM" | "SCI_PHYS" | "SOCIAL_STUDIES" | "ARTS"
  | "LIFE_CAREERS" | "FIN_LIT" | "WORLD_LANG" | "PE_HEALTH";

interface Draft {
  dept: Dept;
  title: string;
  sourcePage: number;
  grades: string | null;
  prereqText: string | null;
  description: string;
  cues: { half: boolean; credits: string | null; dual: boolean };
}

interface Tag {
  kind: Kind;
  credits: number;
  provisional: boolean;
}

export interface CourseSeed {
  slug: string;
  name: string;
  department: Dept;
  level: Level;
  duration: "FULL" | "HALF";
  credits: number;
  gradesOffered: number[];
  description: string;
  prereqText: string | null;
  rules: null;
  dualEnrollmentNote: string | null;
  hasApExam: boolean;
  plannable: boolean;
  sourcePage: number | null;
  requirements: Tag[];
  interests: string[];
}

interface V {
  name: string;
  level: Level;
  dept?: Dept;
  grades?: number[];
  half?: boolean;
  credits?: number;
  /** Requirement tags. A bare kind uses the course credits. [kind, credits] overrides. */
  req?: (Kind | [Kind, number])[];
  /** Same, but provisional: needs counselor review. */
  prov?: Kind[];
  interests?: string[];
  ap?: boolean;
  dual?: string;
  desc?: string;
  prereq?: string | null;
  plannable?: boolean;
  /** Extra sentence appended to the description (judgment calls shown to students). */
  note?: string;
}

const draftFile = JSON.parse(readFileSync(path.resolve("prisma/seed/courses.draft.json"), "utf8")) as { courses: Draft[] };
const drafts = new Map<string, Draft>();
for (const d of draftFile.courses) if (!drafts.has(d.title)) drafts.set(d.title, d); // first listing wins (Applied Physics & Engineering appears twice)

const out: CourseSeed[] = [];
const slugs = new Set<string>();
const used = new Set<string>();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function parseGrades(g: string | null): number[] {
  if (!g) return [];
  return (g.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 9 && n <= 12);
}

function cleanDesc(raw: string, max = 420): string {
  let s = raw;
  const label = /^(?:(?:Full|Half)-[Yy]ear [Ee]lective(?: - Honors)?|Half-year graduation requirement|Dual [Ee]nrollment [Oo]ption with (?:Ramapo College|Syracuse University Project Advance|Syracuse University|Seton Hall University)|Note: [^.]*?(?=In |After )|Co-requisite[^.]*?(?=[A-Z][a-z]+ [A-Z]))\s*/;
  for (let i = 0; i < 4 && label.test(s); i++) s = s.replace(label, "");
  s = s.replace(/^(?:&\s*\d+ college credits|Half-Day Program\/\d+ credits)\s*/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "...").trim();
}

function add(d: Draft | null, dept: Dept, v: V) {
  const slug = slugify(v.name);
  if (slugs.has(slug)) throw new Error(`duplicate slug ${slug}`);
  slugs.add(slug);
  if (d) used.add(d.title);

  const half = v.half ?? d?.cues.half ?? false;
  const credits = v.credits ?? (half ? 2.5 : 5);
  const grades = v.grades ?? parseGrades(d?.grades ?? null);
  if (v.plannable !== false && grades.length === 0) throw new Error(`no grades for ${v.name}`);

  const tags: Tag[] = [
    ...(v.req ?? []).map((r) => (typeof r === "string" ? { kind: r, credits, provisional: false } : { kind: r[0], credits: r[1], provisional: false })),
    ...(v.prov ?? []).map((kind) => ({ kind, credits, provisional: true })),
  ];

  const base = v.desc ?? cleanDesc(d?.description ?? "");
  const description = [base, v.note].filter(Boolean).join(" ");

  out.push({
    slug,
    name: v.name,
    department: v.dept ?? dept,
    level: v.level,
    duration: half ? "HALF" : "FULL",
    credits,
    gradesOffered: grades,
    description,
    prereqText: v.prereq !== undefined ? v.prereq : d?.prereqText ?? null,
    rules: null,
    dualEnrollmentNote: v.dual ?? null,
    hasApExam: v.ap ?? v.level === "AP",
    plannable: v.plannable ?? true,
    sourcePage: d?.sourcePage ?? null,
    requirements: tags,
    interests: v.interests ?? interestsFor(v.name, v.dept ?? dept),
  });
}

/** Look up a draft block by its exact TOC title. */
function D(title: string): Draft {
  const d = drafts.get(title);
  if (!d) throw new Error(`draft not found: ${title}`);
  return d;
}

function def(title: string, ...variants: V[]) {
  const d = D(title);
  for (const v of variants) add(d, d.dept, v);
}

// ---------- interest tags ----------

const INTEREST_TAGS = [
  ["engineering-building", "Engineering and building"],
  ["coding-cs", "Coding and computer science"],
  ["medicine-health", "Medicine and health"],
  ["business-money", "Business and money"],
  ["art-design", "Art and design"],
  ["film-media", "Film and media"],
  ["music-performing", "Music and performing"],
  ["writing-humanities", "Writing and humanities"],
  ["languages", "Languages"],
  ["science-research", "Science research"],
  ["hands-on-careers", "Hands-on career programs (Satellite School)"],
] as const;

function interestsFor(name: string, dept: Dept): string[] {
  const t = new Set<string>();
  const n = name.toLowerCase();
  const byDept: Partial<Record<Dept, string>> = {
    ENGLISH: "writing-humanities",
    SOCIAL_STUDIES: "writing-humanities",
    COMPUTER_SCIENCE: "coding-cs",
    SCIENCE: "science-research",
    WORLD_LANGUAGE: "languages",
    ART: "art-design",
    BUSINESS: "business-money",
    FAMILY_CONSUMER_SCIENCES: "hands-on-careers",
    MUSIC: "music-performing",
    TECHNOLOGY: "engineering-building",
  };
  if (byDept[dept]) t.add(byDept[dept]!);
  if (/anatomy|biology|health|nutrition|early childhood|forensic/.test(n)) t.add("medicine-health");
  if (/video|film|broadcast|journalism|media|movies/.test(n)) t.add("film-media");
  if (/robotics|game|computer|programming|app development/.test(n)) t.add("coding-cs");
  if (/graphic|design|architecture|photography|studio art|ceramics|drawing|fashion|interior/.test(n)) t.add("art-design");
  if (/engineering|physics|architecture|robotics|calculus/.test(n)) t.add("engineering-building");
  if (/research|genetics|forensic|chemistry|astronomy|environmental|natural disasters/.test(n)) t.add("science-research");
  if (/business|marketing|financ|account|entrepreneur|econom|management/.test(n)) t.add("business-money");
  if (/satellite|internship|cadet|teacher assistant|culinary|early childhood|clothing/.test(n)) t.add("hands-on-careers");
  if (/theater|drama|choir|band|music|guitar|piano|keyboard|pop/.test(n)) t.add("music-performing");
  if (/creative writing|literature|journalism|public speaking|philosophy/.test(n)) t.add("writing-humanities");
  return [...t];
}

// =====================================================================
// ENGLISH
// =====================================================================
// Courses in "Other Full-Year English Courses" satisfy the English requirement. The PDF's ELECTIVES
// section (from 21st Century Journalism on) does not, and AP Research "does not count for English credit".
const ENG: Kind[] = ["ENGLISH"];

def("English I/Honors English I: Foundations of Literature",
  { name: "English I", level: "CP", req: ENG },
  { name: "Honors English I", level: "HONORS", req: ENG });
def("English II/Honors English II: Frameworks of Literature",
  { name: "English II", level: "CP", req: ENG },
  { name: "Honors English II", level: "HONORS", req: ENG });
def("English III/Honors English III: Classic & Contemporary American Literature",
  { name: "English III", level: "CP", req: ENG },
  { name: "Honors English III", level: "HONORS", req: ENG });
def("American Studies/Honors American Studies",
  {
    name: "American Studies", level: "CP", credits: 10, req: [["ENGLISH", 5], ["SOCIAL_STUDIES", 5]],
    note: "Counts toward both English and Social Studies. The 5 + 5 credit split is unverified.",
  },
  {
    name: "Honors American Studies", level: "HONORS", credits: 10, req: [["ENGLISH", 5], ["SOCIAL_STUDIES", 5]],
    note: "Counts toward both English and Social Studies. The 5 + 5 credit split is unverified.",
  });
def("English IV/Honors English IV: World Literature & Culture",
  { name: "English IV", level: "CP", req: ENG },
  { name: "Honors English IV", level: "HONORS", req: ENG });
def("Advanced Placement Capstone: Seminar (Year One of AP Capstone Sequence)",
  { name: "AP Capstone: Seminar", level: "AP", req: ENG });
def("Advanced Placement Capstone: Research (Year Two of AP Capstone Sequence)",
  { name: "AP Capstone: Research", level: "AP", note: "Elective. Does not count for English credit." });
def("Reading Science Fiction Literature/Honors Reading Science Fiction Literature",
  { name: "Reading Science Fiction Literature", level: "CP", req: ENG },
  { name: "Honors Reading Science Fiction Literature", level: "HONORS", req: ENG });
def("Language, Myth, and Culture/Honors Language, Myth, and Culture",
  { name: "Language, Myth, and Culture", level: "CP", req: ENG },
  { name: "Honors Language, Myth, and Culture", level: "HONORS", req: ENG, dual: "Dual enrollment option with Seton Hall University." });
def("Sports and Literature", { name: "Sports and Literature", level: "CP", req: ENG });
def("Philosophy and Literature/Honors Philosophy and Literature",
  { name: "Philosophy and Literature", level: "CP", req: ENG },
  { name: "Honors Philosophy and Literature", level: "HONORS", req: ENG });
def("Honors Drama and Shakespeare", { name: "Honors Drama and Shakespeare", level: "HONORS", req: ENG, interests: ["writing-humanities", "music-performing"] });
def("Literature of the Holocaust/Honors Literature of the Holocaust",
  { name: "Literature of the Holocaust", level: "CP", req: ENG },
  { name: "Honors Literature of the Holocaust", level: "HONORS", req: ENG, dual: "Dual enrollment option with Kean University." });
def("Advanced Placement Language and Composition", { name: "AP Language and Composition", level: "AP", req: ENG });
def("Advanced Placement Literature and Composition", { name: "AP Literature and Composition", level: "AP", req: ENG });
def("21st Century Journalism & Media", { name: "21st Century Journalism & Media", level: "CP" });
def("Honors Advanced 21st Century Journalism & Media", { name: "Honors Advanced 21st Century Journalism & Media", level: "HONORS" });
def("Honors Advanced 21st Century Journalism & Media II", { name: "Honors Advanced 21st Century Journalism & Media II", level: "HONORS" });
def("Film and Literature: Understanding Movies from Script to Screen", { name: "Film and Literature: Understanding Movies from Script to Screen", level: "CP" });
def("Creative Writing", { name: "Creative Writing", level: "CP" });
def("Theater Arts", { name: "Theater Arts", level: "CP", prov: ["ARTS"], interests: ["music-performing", "writing-humanities"] });
def("Public Speaking", { name: "Public Speaking", level: "CP" });

// =====================================================================
// SOCIAL STUDIES
// =====================================================================
const SS: Kind[] = ["SOCIAL_STUDIES"];
const HONORS_SS = "Honors placement is by recommendation of teacher and supervisor.";
def("World History",
  { name: "World History", level: "CP", req: SS },
  { name: "Honors World History", level: "HONORS", req: SS, note: HONORS_SS });
def("U. S. History I",
  { name: "U.S. History I", level: "CP", req: SS },
  { name: "Honors U.S. History I", level: "HONORS", req: SS, note: HONORS_SS });
def("U. S. History II",
  { name: "U.S. History II", level: "CP", req: SS },
  { name: "Honors U.S. History II", level: "HONORS", req: SS, note: HONORS_SS });
def("Advanced Placement U.S. History I & II",
  { name: "AP U.S. History I", level: "AP", grades: [10], req: SS },
  {
    name: "AP U.S. History II", level: "AP", grades: [11], req: SS, prereq: null,
    note: "Year two of the AP U.S. History I & II sequence.",
  });
def("Advanced Placement World History", { name: "AP World History", level: "AP" });
def("Advanced Placement Art History*", { name: "AP Art History", level: "AP", note: "Does not satisfy the Visual/Performing Arts requirement." });
def("Sociology", { name: "Sociology", level: "CP" });
def("Advanced Placement Microeconomics", { name: "AP Microeconomics", level: "AP", note: "Students must also take AP Macroeconomics." });
def("Advanced Placement Macroeconomics", { name: "AP Macroeconomics", level: "AP" });
def("Constitutional Law", { name: "Constitutional Law", level: "CP" });
def("Religion in America", { name: "Religion in America", level: "CP" });
def("Critical Analysis of History Through Film", { name: "Critical Analysis of History Through Film", level: "CP" });
def("One World, One Community: World Problems Today", { name: "One World, One Community: World Problems Today", level: "CP" });
def("Honors Psychology", { name: "Honors Psychology", level: "HONORS", dual: "Dual enrollment option with Ramapo College." });
def("An Introduction to the Analysis of Public Policy",
  {
    name: "An Introduction to the Analysis of Public Policy", level: "HONORS",
    dual: "Dual enrollment option with Syracuse University Project Advance.",
    note: "Must be taken together with AP American Government and Politics.",
  });
def("Advanced Placement American Government and Politics",
  { name: "AP American Government and Politics", level: "AP", note: "Must be taken together with An Introduction to the Analysis of Public Policy." });
def("History of Sport in America", { name: "History of Sport in America", level: "HONORS" });

// =====================================================================
// MATH (grade bands come from the group headers in the PDF)
// =====================================================================
const MATH: Kind[] = ["MATH"];
const G9 = [9], G10 = [10];
const ALG2_GRADES = [9, 10, 11];

def("Honors Geometry", { name: "Honors Geometry", level: "HONORS", grades: G9, req: MATH,
  desc: "In addition to covering the material from Geometry and Geometry Enhanced, Honors Geometry addresses additional topics and requires students to solve more challenging, non-routine problems." });
def("Geometry Enhanced", { name: "Geometry Enhanced", level: "ENHANCED", grades: G9, req: MATH,
  desc: "In Geometry Enhanced, students study some topics in greater depth, and the pace of the course will be faster than in Geometry." });
def("Geometry", { name: "Geometry", level: "CP", grades: G9, req: MATH,
  desc: "In Geometry, students study the same concepts as in Geometry Enhanced, but with a greater emphasis on mastering prerequisite skills and a slightly slower pace." });
def("Algebra I Enhanced", { name: "Algebra I Enhanced", level: "ENHANCED", grades: G10, req: MATH,
  desc: "The concepts presented in Algebra I courses are intended to extend and deepen the development of algebraic reasoning that began in middle school. In Algebra I Enhanced, students study some topics in greater depth, and the pace of the course will be faster than in Algebra I." });
def("Algebra I", { name: "Algebra I", level: "CP", grades: G10, req: MATH,
  desc: "The concepts presented in Algebra I courses are intended to extend and deepen the development of algebraic reasoning that began in middle school. In Algebra I, students study the same concepts as in Algebra I Enhanced, but with a greater emphasis on mastering prerequisite skills and a slightly slower pace." });
def("Honors Algebra II with Trigonometry", { name: "Honors Algebra II with Trigonometry", level: "HONORS", grades: ALG2_GRADES, req: MATH,
  desc: "In addition to covering the material from Algebra II with Trigonometry and Algebra II with Trigonometry Enhanced, Honors Algebra II with Trigonometry addresses additional topics and requires students to solve more challenging, non-routine problems. Graphing calculators are used regularly." });
def("Algebra II with Trigonometry Enhanced", { name: "Algebra II with Trigonometry Enhanced", level: "ENHANCED", grades: ALG2_GRADES, req: MATH,
  prereq: "Prerequisite: An initial test/quiz average of ‘C+’ or higher in Algebra I Enhanced or ‘A’ or higher in Algebra I, and an initial test/quiz average of ‘C+’ or higher in Geometry Enhanced or ‘A’ or higher in Geometry Placement by recommendation of teacher and supervisor",
  desc: "Algebra II with Trigonometry extends students’ understanding of functions and function families to include polynomial, rational, radical, and trigonometric functions. In Algebra II with Trigonometry Enhanced, students study some topics in greater depth, and the pace of the course will be faster." });
def("Algebra II with Trigonometry", { name: "Algebra II with Trigonometry", level: "CP", grades: ALG2_GRADES, req: MATH,
  desc: "Algebra II with Trigonometry extends students’ understanding of functions and function families to include polynomial, rational, radical, and trigonometric functions. Students study the same concepts as in the Enhanced course, with a greater emphasis on mastering prerequisite skills and a slightly slower pace." });
def("Algebra II", { name: "Algebra II", level: "CP", grades: ALG2_GRADES, req: MATH,
  desc: "In Algebra II, students solidify, strengthen, and extend their understanding of Algebra I and Geometry content." });
def("College Algebra", { name: "College Algebra", level: "CP", req: MATH, dual: "Dual enrollment option with William Paterson University." });
def("Advanced Placement Pre-Calculus", { name: "AP Pre-Calculus", level: "AP", grades: [10, 11, 12], req: MATH });
def("Pre-Calculus", { name: "Pre-Calculus", level: "CP", grades: [10, 11, 12], req: MATH, dual: "Dual enrollment option with William Paterson University." });
def("Advanced Placement Calculus BC", { name: "AP Calculus BC", level: "AP", grades: [11, 12], req: MATH });
def("Advanced Placement Calculus AB", { name: "AP Calculus AB", level: "AP", grades: [11, 12], req: MATH });
def("Calculus", { name: "Calculus", level: "CP", grades: [11, 12], req: MATH, dual: "Dual enrollment option with William Paterson University." });
def("Advanced Topics in Calculus (Honors)", { name: "Advanced Topics in Calculus (Honors)", level: "HONORS", grades: [11, 12], req: MATH, dual: "Dual enrollment option with William Paterson University." });
def("Statistics", { name: "Statistics", level: "CP", req: MATH, dual: "Dual enrollment option with William Paterson University.", desc: cleanDesc(D("Statistics").description.replace(/^Statistics\s+/, "")) });
def("Advanced Placement Statistics", { name: "AP Statistics", level: "AP", grades: [11, 12], req: MATH });
def("Discrete Math", { name: "Discrete Math", level: "CP", req: MATH, dual: "Dual enrollment option with William Paterson University.", desc: cleanDesc(D("Discrete Math").description.replace(/^Discrete Math\s+/, "")) });

// Computer science sits in the Math department section of the PDF.
def("Introduction to Computer Science and App Development", { name: "Introduction to Computer Science and App Development", level: "CP", dept: "COMPUTER_SCIENCE",
  prereq: "Co-requisite or Prerequisite: Geometry or Geometry Enhanced" });
def("Honors Computer Science", { name: "Honors Computer Science", level: "HONORS", dept: "COMPUTER_SCIENCE",
  desc: "In this full-year elective course students will learn the fundamentals of computer programming in Java, with an emphasis on the development of logical thinking and problem-solving skills.",
  prereq: "Co-requisite or Prerequisite: Honors Algebra II with Trigonometry or Algebra II with Trigonometry Enhanced and a high level of interest in programming, or Intro to Computer Science and App Development Placement by recommendation of teacher and supervisor" });
def("Advanced Placement Computer Science A", { name: "AP Computer Science A", level: "AP", dept: "COMPUTER_SCIENCE" });
def("Advanced Topics in Computer Science (Honors)", { name: "Advanced Topics in Computer Science (Honors)", level: "HONORS", dept: "COMPUTER_SCIENCE" });

// Middle school pseudo-courses so the eligibility engine can reference 8th grade math.
for (const [name, desc] of [
  ["Math 8", "Eighth grade mathematics. Reference only, not plannable."],
  ["Algebra I (8th grade)", "Algebra I taken in 8th grade. Reference only, not plannable."],
  ["Pre-Algebra (8th grade)", "Pre-Algebra taken in 8th grade. Reference only, not plannable."],
] as const) {
  add(null, "MATH", { name, level: "MIDDLE_SCHOOL", credits: 0, grades: [8], plannable: false, desc, prereq: null, interests: [] });
}

// =====================================================================
// SCIENCE
// =====================================================================
const BIO: Kind[] = ["SCI_BIO"], CHEM: Kind[] = ["SCI_CHEM"], PHYS: Kind[] = ["SCI_PHYS"];
const HS_BIO_CREDIT_NOTE = "Transcripts have shown 6 credits for this honors course. The catalog lists 5 until a counselor confirms.";

def("Biology", { name: "Biology", level: "CP", req: BIO });
def("Biology Enhanced", { name: "Biology Enhanced", level: "ENHANCED", req: BIO });
def("Honors Biology", { name: "Honors Biology", level: "HONORS", req: BIO, note: HS_BIO_CREDIT_NOTE });
def("Advanced Placement Biology", { name: "AP Biology", level: "AP", interests: ["science-research", "medicine-health"],
  prereq: "Placement by recommendation of teacher and supervisor Co-requisite or Prerequisite: Honors Chemistry, Honors Physics" });
def("Chemistry", { name: "Chemistry", level: "CP", req: CHEM });
def("Chemistry Enhanced", { name: "Chemistry Enhanced", level: "ENHANCED", req: CHEM });
def("Honors Chemistry", { name: "Honors Chemistry", level: "HONORS", req: CHEM, note: HS_BIO_CREDIT_NOTE,
  prereq: "Prerequisite: ‘B’ or better in Honors Biology OR an ‘A’ in Biology Enhanced. Students who have not completed Algebra I will also have to complete a math skills placement test prior to final placement decision. Suggested Co-requisite: Honors Algebra II with Trigonometry or Algebra II with Trigonometry Enhanced",
  desc: "Honors Chemistry is an accelerated and highly rigorous laboratory science course designed for students with strong math and analytical skills." });
def("Advanced Placement Chemistry", { name: "AP Chemistry", level: "AP" });
def("Physics", { name: "Physics", level: "CP", req: PHYS });
def("Physics Enhanced", { name: "Physics Enhanced", level: "ENHANCED", req: PHYS });
def("Honors Physics", { name: "Honors Physics", level: "HONORS", req: PHYS });
def("Advanced Placement Physics I", { name: "AP Physics I", level: "AP", req: PHYS });
// Listed twice in the PDF (Science p42, Technology Education p68) with different prerequisites.
def("Applied Physics & Engineering", { name: "Applied Physics & Engineering", level: "CP", dept: "SCIENCE", credits: 10, req: [["SCI_PHYS", 5]],
  interests: ["engineering-building", "science-research"],
  prereq: "Science Department listing: Prerequisite: Algebra I. Technology Education listing: Prerequisite: Chemistry",
  note: "Two-period, 10-credit course. Fulfills the physics graduation requirement. The PDF lists two different prerequisites." });
used.add("Applied Physics & Engineering");
def("Advanced Placement Physics II", { name: "AP Physics II", level: "AP" });
def("Advanced Placement Physics C", { name: "AP Physics C", level: "AP" });
def("Science, Ethics, Technology and Society", { name: "Science, Ethics, Technology and Society", level: "CP" });
def("Honors Forensic Science", { name: "Honors Forensic Science", level: "HONORS", dual: "Dual enrollment option with Syracuse University (4 college credits)." });
def("Honors Research in Molecular Genetics I", { name: "Honors Research in Molecular Genetics I", level: "HONORS" });
def("Honors Research in Molecular Genetics II and III",
  { name: "Honors Research in Molecular Genetics II", level: "HONORS" },
  { name: "Honors Research in Molecular Genetics III", level: "HONORS" });
def("Introduction to Anatomy and Physiology", { name: "Introduction to Anatomy and Physiology", level: "CP" });
def("Honors Anatomy and Physiology", { name: "Honors Anatomy and Physiology", level: "HONORS" });
def("Astronomy", { name: "Astronomy", level: "CP" });
def("Earth’s Natural Disasters", { name: "Earth’s Natural Disasters", level: "CP" });
def("Advanced Placement Environmental Science", { name: "AP Environmental Science", level: "AP" });

// =====================================================================
// WORLD LANGUAGE
// =====================================================================
const WL: Kind[] = ["WORLD_LANG"];
const LANGS = ["Chinese", "French", "Italian", "Spanish"];
const ROMAN = ["I", "II", "III", "IV", "V"];
const wlI = D("Chinese I, French I, Italian I and Spanish I");
const wlII = D("Chinese II, French II, Italian II and Spanish II");
const wlIII = D("Chinese III, French III, Italian III and Spanish III");
const wlIV = D("Chinese IV and V, French IV and V, Italian IV and V, and Spanish IV and V");
const wlHon = D("Honors Chinese, French, Italian, Spanish – II, III, and IV");
const wlAP = D("Advanced Placement Language & Culture (French/Italian/Spanish/Chinese)");
for (const L of LANGS) {
  ROMAN.forEach((r, i) => {
    const d = [wlI, wlII, wlIII, wlIV, wlIV][i];
    add(d, "WORLD_LANGUAGE", {
      name: `${L} ${r}`, level: "CP", req: WL, prereq: null,
      grades: i >= 3 ? [10, 11, 12] : [9, 10, 11, 12],
      dual: i >= 3 ? "Dual enrollment option with Seton Hall University." : undefined,
    });
  });
  ["II", "III", "IV"].forEach((r) =>
    add(wlHon, "WORLD_LANGUAGE", { name: `Honors ${L} ${r}`, level: "HONORS", req: WL, prereq: null, grades: [9, 10, 11, 12] }));
  add(wlAP, "WORLD_LANGUAGE", { name: `AP ${L} Language and Culture`, level: "AP", req: WL, grades: [11, 12],
    dual: "Dual enrollment option with Seton Hall University." });
}
def("Advanced Placement Literature (Spanish)", { name: "AP Spanish Literature and Culture", level: "AP", req: WL });
const heritage = D("Spanish for Heritage Speakers I & II & III (*Honors)");
for (const r of ["I", "II", "III"]) {
  add(heritage, "WORLD_LANGUAGE", { name: `Spanish for Heritage Speakers ${r}`, level: "CP", req: WL, grades: [9, 10, 11], prereq: null,
    note: "Honors designation and course credit are available to eligible students." });
}
def("English Language Development", { name: "English Language Development", level: "CP", interests: ["languages"] });

// =====================================================================
// ART (Visual/Performing Arts tags are provisional: the PDF does not list the exact courses)
// =====================================================================
const ARTS: Kind[] = ["ARTS"];
const AP_ART_NOTE = "Grades are not stated in the PDF.";
def("Studio Art I", { name: "Studio Art I", level: "CP", prov: ARTS });
def("Honors Advanced Studio Art II", { name: "Honors Advanced Studio Art II", level: "HONORS", prov: ARTS });
def("Ceramics & Sculpture I", { name: "Ceramics & Sculpture I", level: "CP", prov: ARTS });
def("Honors Advanced Ceramics & Sculpture II", { name: "Honors Advanced Ceramics & Sculpture II", level: "HONORS", prov: ARTS });
def("Photography I", { name: "Photography I", level: "CP", prov: ARTS });
def("Honors Advanced Photography II*", { name: "Honors Advanced Photography II", level: "HONORS", prov: ARTS });
def("Communication Design", { name: "Communication Design", level: "CP", prov: ARTS });
def("Advanced Placement Drawing", { name: "AP Drawing", level: "AP", grades: [11, 12], prov: ARTS, note: AP_ART_NOTE });
def("Advanced Placement 2-D Art and Design", { name: "AP 2-D Art and Design", level: "AP", grades: [11, 12], prov: ARTS, note: AP_ART_NOTE });
def("Advanced Placement 3-D Art and Design", { name: "AP 3-D Art and Design", level: "AP", grades: [11, 12], prov: ARTS, note: AP_ART_NOTE });

// =====================================================================
// BUSINESS (21st Century Life and Careers tags are provisional)
// =====================================================================
const LIFE: Kind[] = ["LIFE_CAREERS"];
def("Financial Literacy", { name: "Financial Literacy", level: "CP", req: ["FIN_LIT"] });
def("Financial Literacy (Hybrid)*", { name: "Financial Literacy (Hybrid)", level: "CP", req: ["FIN_LIT"], note: "Online hybrid option that fulfills the same requirement." });
def("Principles of Business", { name: "Principles of Business", level: "CP", prov: LIFE });
def("Entrepreneurship", { name: "Entrepreneurship", level: "CP", prov: LIFE });
def("Marketing", { name: "Marketing", level: "CP", prov: LIFE });
def("Management and Leadership", { name: "Management and Leadership", level: "CP", prov: LIFE });
def("Honors Marketing and Merchandising", { name: "Honors Marketing and Merchandising", level: "HONORS", prov: LIFE });
def("Financial Investment", { name: "Financial Investment", level: "CP", prov: LIFE });
def("Accounting", { name: "Accounting", level: "CP", prov: LIFE });
def("Career Exploration (Internship)", { name: "Career Exploration (Internship)", level: "CP", credits: 15, prov: LIFE, note: "Senior half-day program worth 15 credits." });
def("Honors Teacher Cadet Program", { name: "Honors Teacher Cadet Program", level: "HONORS" });
def("Pascack Valley Regional High School District Teacher Assistant Program",
  { name: "Teacher Assistant Program", level: "CP", grades: [11, 12], interests: ["hands-on-careers"],
    note: "Worth 2.5 or 5 credits depending on the length of the course. Does not fulfill any State requirement." });

// =====================================================================
// FAMILY AND CONSUMER SCIENCES
// =====================================================================
def("21st Century Life Skills", { name: "21st Century Life Skills", level: "CP", prov: LIFE });
def("Culinary Arts I", { name: "Culinary Arts I", level: "CP", prov: LIFE });
def("Culinary Arts II", { name: "Culinary Arts II", level: "CP", prov: LIFE });
def("Clothing Construction", { name: "Clothing Construction", level: "CP", prov: LIFE });
def("Advanced Clothing Construction", { name: "Advanced Clothing Construction", level: "CP", prov: LIFE });
def("Fashion Design", { name: "Fashion Design", level: "CP", prov: LIFE });
def("Advanced Fashion Design", { name: "Advanced Fashion Design", level: "CP", prov: LIFE });
def("Interior Design", { name: "Interior Design", level: "CP", prov: LIFE });
def("Early Childhood and Family Education I", { name: "Early Childhood and Family Education I", level: "CP", grades: [9, 10, 11, 12], prov: LIFE });
def("Early Childhood and Family Education II", { name: "Early Childhood and Family Education II", level: "CP", prov: LIFE });
def("Early Childhood and Family Education III", { name: "Early Childhood and Family Education III", level: "CP", prov: LIFE });
def("Daily Food Preparation and Nutrition Skills", { name: "Daily Food Preparation and Nutrition Skills", level: "CP", prov: LIFE });

// =====================================================================
// HEALTH AND PE: per-grade rows are not catalog entries, so they are seeded by hand.
// =====================================================================
const PE_DESC = "Combined Physical Education and Health Education. New Jersey requires 150 minutes of Physical Education/Health & Safety per week.";
for (const [name, grade, extra] of [
  ["Physical Education/Health 9", 9, ""],
  ["Physical Education/Driver Ed 10", 10, " Includes driver and traffic safety education."],
  ["Physical Education/Health 11", 11, ""],
  ["Physical Education/Health 12", 12, ""],
] as const) {
  add(null, "HEALTH_PE", { name, level: "CP", grades: [grade], req: ["PE_HEALTH"], desc: PE_DESC + extra, prereq: null, interests: [] });
}
used.add("Health Education");
used.add("Physical Education");

// =====================================================================
// MUSIC (arts tags provisional)
// =====================================================================
const MUS_DUAL = "Dual enrollment option with Seton Hall University.";
def("Choir/Lunch", { name: "Choir/Lunch", level: "CP", credits: 2.5, prov: ARTS, note: "Meets for a half period. The 2.5 credit value is unverified." });
def("Concert Choir", { name: "Concert Choir", level: "CP", prov: ARTS });
def("Chamber Choir", { name: "Chamber Choir", level: "CP", prov: ARTS, dual: MUS_DUAL });
def("Honors Chamber Choir", { name: "Honors Chamber Choir", level: "HONORS", prov: ARTS });
def("Concert Band", { name: "Concert Band", level: "CP", prov: ARTS, dual: MUS_DUAL });
def("Honors Concert Band", { name: "Honors Concert Band", level: "HONORS", prov: ARTS });
def("Modern Rock Band", { name: "Modern Rock Band", level: "CP", prov: ARTS });
def("Keyboard/Piano", { name: "Keyboard/Piano", level: "CP", prov: ARTS });
def("Music Technology*", { name: "Music Technology", level: "CP", prov: ARTS, dual: MUS_DUAL });
def("Music Theory", { name: "Music Theory", level: "CP", prov: ARTS });
def("Advanced Placement Music Theory", { name: "AP Music Theory", level: "AP", prov: ARTS, dual: MUS_DUAL });
def("Guitar I", { name: "Guitar I", level: "CP", prov: ARTS });
def("American Pop Music", { name: "American Pop Music", level: "CP", prov: ARTS });

// =====================================================================
// TECHNOLOGY EDUCATION
// =====================================================================
def("Creative Design Principles in STEM", { name: "Creative Design Principles in STEM", level: "CP", prov: LIFE });
def("Graphic Design I", { name: "Graphic Design I", level: "CP", prov: LIFE });
def("Graphic Design II", { name: "Graphic Design II", level: "CP", prov: LIFE });
def("Architecture", { name: "Architecture", level: "CP", prov: LIFE });
def("Robotics and Game Design", { name: "Robotics and Game Design", level: "CP", prov: LIFE });
def("Honors Engineering Design I", { name: "Honors Engineering Design I", level: "HONORS", prov: LIFE, dual: "Dual enrollment option with the University of Texas at Austin." });
def("Honors Engineering Design II", { name: "Honors Engineering Design II", level: "HONORS", req: PHYS, prov: LIFE,
  note: "Fulfills the physics graduation requirement." });
used.add("Applied Physics & Engineering");
def("Video Production", { name: "Video Production", level: "CP", prov: LIFE });
def("Advanced Video Production", { name: "Advanced Video Production", level: "CP", prov: LIFE });
def("Honors Broadcast Television Production", { name: "Honors Broadcast Television Production", level: "HONORS", prov: LIFE });
def("Honors Research in Innovation and Design", { name: "Honors Research in Innovation and Design", level: "HONORS", prov: LIFE });

// =====================================================================
// OTHER PROGRAMS and SPECIAL EDUCATION
// =====================================================================
const UNKNOWN_CREDITS = "Credit value is not stated in the PDF. Confirm with a counselor.";
def("Satellite School", { name: "Satellite School", level: "CP", dept: "OTHER", interests: ["hands-on-careers"], note: UNKNOWN_CREDITS });
def("Virtual High School (VHS)", { name: "Virtual High School (VHS)", level: "CP", dept: "OTHER", note: UNKNOWN_CREDITS });
def("Study Skills", { name: "Study Skills", level: "CP" });
def("English 1-2 and 3-4", { name: "English 1-2 and 3-4", level: "CP", grades: [9, 10, 11, 12], note: UNKNOWN_CREDITS });
def("Themes in World History", { name: "Themes in World History", level: "CP", req: SS });
def("Themes in United States History I", { name: "Themes in United States History I", level: "CP", req: SS });
def("Themes in United States History II", { name: "Themes in United States History II", level: "CP", req: SS });
def("Math 1-2 and 3-4", { name: "Math 1-2 and 3-4", level: "CP", grades: [9, 10, 11, 12], note: UNKNOWN_CREDITS });
def("Elements of Biological Science", { name: "Elements of Biological Science", level: "CP", grades: [9, 10] });
def("Elements of Chemistry in the Community", { name: "Elements of Chemistry in the Community", level: "CP", grades: [9, 10] });
def("Elements of Conceptual Physics", { name: "Elements of Conceptual Physics", level: "CP", grades: [11, 12] });
def("Elements of Science 1", { name: "Elements of Science 1", level: "CP", grades: [9, 10] });
def("Elements of Science 2", { name: "Elements of Science 2", level: "CP", grades: [9, 10] });
def("Elements of Science 3", { name: "Elements of Science 3", level: "CP", grades: [10, 11] });
def("Elements of Innovation and Design", { name: "Elements of Innovation and Design", level: "CP", interests: ["engineering-building"] });
def("Spanish Conversation & Culture", { name: "Spanish Conversation & Culture", level: "CP", interests: ["languages"] });
def("Transition Education 1 and 2", { name: "Transition Education 1 and 2", level: "CP", grades: [11, 12], note: UNKNOWN_CREDITS });
def("Daily Living Skills 1 and 2", { name: "Daily Living Skills 1 and 2", level: "CP", grades: [9, 10], note: UNKNOWN_CREDITS });
def("Related Arts", { name: "Related Arts", level: "CP" });
def("Elements of Financial Literacy", { name: "Elements of Financial Literacy", level: "CP", half: true, credits: 2.5, req: ["FIN_LIT"],
  note: "Credit value is assumed to match Financial Literacy (2.5)." });

// ---------- coverage check: every draft block is either used or deliberately skipped ----------
const SKIPPED = new Set([
  "Honors Courses", "Honors/Advanced Placement Courses", "Honors Program", "Opportunities for Acceleration",
]);
const unused = draftFile.courses.filter((c) => !used.has(c.title) && !SKIPPED.has(c.title));
if (unused.length) {
  console.error("Draft blocks with no course:", unused.map((u) => u.title));
  process.exit(1);
}

// =====================================================================
// Sidecar files
// =====================================================================
const requirements = [
  { kind: "ENGLISH", label: "English", requiredCredits: 20, notes: "4 years of English" },
  { kind: "PE_HEALTH", label: "Physical Education and Health", requiredCredits: 20, notes: "4 years of Physical Education and Health Education" },
  { kind: "MATH", label: "Mathematics", requiredCredits: 15, notes: "3 years of Mathematics" },
  { kind: "SCI_BIO", label: "Biology", requiredCredits: 5, notes: "Biology" },
  { kind: "SCI_CHEM", label: "Chemistry", requiredCredits: 5, notes: "Chemistry" },
  { kind: "SCI_PHYS", label: "Physics", requiredCredits: 5, notes: "Physics. Applied Physics & Engineering and Honors Engineering Design II also count." },
  { kind: "SOCIAL_STUDIES", label: "Social Studies", requiredCredits: 15, notes: "World History, U.S. History I and II" },
  { kind: "ARTS", label: "Visual/Performing Arts", requiredCredits: 5, notes: "1 year. Course list is provisional until a counselor confirms it." },
  { kind: "LIFE_CAREERS", label: "21st Century Life and Careers", requiredCredits: 5, notes: "1 year. Course list is provisional until a counselor confirms it." },
  { kind: "FIN_LIT", label: "Financial Literacy", requiredCredits: 2.5, notes: "Half year" },
  { kind: "WORLD_LANG", label: "World Language", requiredCredits: 10, notes: "2 years of a World Language" },
];

const aliasTargets: [string, string][] = [
  // Transcript spellings seen in practice, mapped by normalised form at import time.
  ["Physical Education/Health 9", "physical-education-health-9"],
  ["Physical Education/Driver Ed 10", "physical-education-driver-ed-10"],
  ["Physical Education/Health 11", "physical-education-health-11"],
  ["Physical Education/Health 12", "physical-education-health-12"],
  ["United States History I", "u-s-history-i"],
  ["United States History II", "u-s-history-ii"],
  ["Honors United States History I", "honors-u-s-history-i"],
  ["Honors United States History II", "honors-u-s-history-ii"],
  ["Advanced Placement United States History I", "ap-u-s-history-i"],
  ["Advanced Placement Computer Science A", "ap-computer-science-a"],
  ["Algebra II w/ Trigonometry", "algebra-ii-with-trigonometry"],
  ["Algebra 2", "algebra-ii"],
  ["Pre Calculus", "pre-calculus"],
  ["Precalculus", "pre-calculus"],
  ["Intro to Computer Science and App Development", "introduction-to-computer-science-and-app-development"],
  ["Intro to Computer Science", "introduction-to-computer-science-and-app-development"],
];
const knownSlugs = new Set(out.map((c) => c.slug));
const aliases = aliasTargets.map(([title, slug]) => {
  if (!knownSlugs.has(slug)) throw new Error(`alias target missing: ${slug}`);
  return { alias: normalizeTitle(title), courseSlug: slug };
});

const seed = path.resolve("prisma/seed");
writeFileSync(path.join(seed, "courses.json"), JSON.stringify(out, null, 2) + "\n");
writeFileSync(path.join(seed, "requirements.json"), JSON.stringify(requirements, null, 2) + "\n");
writeFileSync(path.join(seed, "interest-tags.json"), JSON.stringify(INTEREST_TAGS.map(([slug, label]) => ({ slug, label })), null, 2) + "\n");
writeFileSync(path.join(seed, "aliases.json"), JSON.stringify(aliases, null, 2) + "\n");

const count = (f: (c: CourseSeed) => boolean) => out.filter(f).length;
console.log(`courses: ${out.length} (plannable ${count((c) => c.plannable)})`);
console.log(`half-year: ${count((c) => c.duration === "HALF")}, with requirement tags: ${count((c) => c.requirements.length > 0)}`);
console.log(`provisional tags: ${out.flatMap((c) => c.requirements).filter((r) => r.provisional).length}`);
console.log(`aliases: ${aliases.length}`);
