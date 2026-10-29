/**
 * Writes prisma/seed/rules.json and prisma/seed/edges.json.
 *
 * Every rule here comes from the prerequisite text in the 2026-2027 Program of Studies. `pages` are
 * PDF file page numbers (the same numbering as `sourcePage` in courses.json). Anything the PDF does
 * not state as a checkable condition is a `manual` leaf. Reading calls that are not obvious carry a
 * note and are listed at the bottom of docs/spec/14-open-items.md.
 * Run: npx tsx scripts/build-rules.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Grade } from "../src/lib/eligibility/grades";
import type { LeafRule, Rule } from "../src/lib/eligibility/types";

type Extra = Partial<Pick<LeafRule, "appealable" | "advisory" | "note">>;

const all = (...rules: Rule[]): Rule => ({ type: "all", rules });
const any = (...rules: Rule[]): Rule => ({ type: "any", rules });
const done = (courses: string[], e: Extra = {}): Rule => ({ type: "completed", courses, ...e });
const grade = (courses: string[], g: Grade, basis: "initialAverage" | "final" = "initialAverage", e: Extra = {}): Rule => ({
  type: "minGrade",
  courses,
  grade: g,
  basis,
  ...e,
});
const co = (courses: string[], e: Extra = {}): Rule => ({ type: "coreq", courses, ...e });
const manual = (label: string, e: Extra = {}): Rule => ({ type: "manual", label, ...e });
const prior = (value: "ALGEBRA_I" | "PRE_ALGEBRA" | undefined, minGrade: Grade | undefined, e: Extra = {}): Rule => ({
  type: "priorCoursework",
  field: "eighthMath",
  ...(value ? { value } : {}),
  ...(minGrade ? { minGrade } : {}),
  ...e,
});
/** "Co-requisite or Prerequisite". */
const coOrPre = (courses: string[], e: Extra = {}): Rule => any(done(courses, e), co(courses, e));

const REC = "Recommendation of teacher and supervisor";
const EXAM = "Proficiency on a placement exam";

// Subject families. The PDF names these generically ("9th Grade English", "a biology course").
const ENG9 = ["english-i", "honors-english-i"];
const ENG10 = ["english-ii", "honors-english-ii", "ap-capstone-seminar"];
const ENG11 = ["english-iii", "honors-english-iii", "american-studies", "honors-american-studies"];
const WORLD = ["world-history", "honors-world-history"];
const USH1 = ["u-s-history-i", "honors-u-s-history-i", "ap-u-s-history-i"];
const BIO = ["biology", "biology-enhanced", "honors-biology", "ap-biology"];
const CHEM = ["chemistry", "chemistry-enhanced", "honors-chemistry", "ap-chemistry"];
const PHYS = ["physics", "physics-enhanced", "honors-physics", "ap-physics-i"];
const CALC = ["calculus", "ap-calculus-ab", "ap-calculus-bc"];

const courses = JSON.parse(readFileSync(path.join("prisma/seed/courses.json"), "utf8")) as {
  slug: string;
  department: string;
  sourcePage: number;
}[];
const inDept = (d: string, except: string) => courses.filter((c) => c.department === d && c.slug !== except).map((c) => c.slug);

interface Entry {
  rules: Rule;
  pages: number[];
}
const R: Record<string, Entry> = {};
const rule = (slug: string, pages: number | number[], rules: Rule) => {
  R[slug] = { rules, pages: Array.isArray(pages) ? pages : [pages] };
};

// ---------- English (p16-21) ----------
for (const s of ["english-ii", "honors-english-ii"]) rule(s, 16, done(ENG9, { note: "Any 9th grade English course." }));
for (const s of ["english-iii", "honors-english-iii"]) rule(s, 16, done(ENG10, { note: "Any 10th grade English course." }));
for (const s of ["american-studies", "honors-american-studies"]) {
  rule(s, 17, all(done(ENG10, { note: "Any 10th grade English course." }), done(USH1, { note: "Any 10th grade U.S. History course." })));
}
for (const s of ["english-iv", "honors-english-iv"]) rule(s, 17, done(ENG11, { note: "Any 11th grade English course." }));
rule("ap-capstone-seminar", 17, done(ENG9, { note: "Any 9th grade English course." }));
rule("ap-capstone-research", 18, done(["ap-capstone-seminar"]));
for (const s of ["reading-science-fiction-literature", "honors-reading-science-fiction-literature"]) {
  rule(s, 18, done(ENG10, { note: "Any 10th grade English course." }));
}
rule("honors-advanced-21st-century-journalism-and-media", 20, done(["21st-century-journalism-and-media"]));
rule("honors-advanced-21st-century-journalism-and-media-ii", 21, done(["honors-advanced-21st-century-journalism-and-media"]));

// ---------- Social studies (p24-28) ----------
for (const s of ["u-s-history-i", "honors-u-s-history-i"]) rule(s, 24, done(WORLD, { note: "Any 9th grade World History course." }));
rule("u-s-history-ii", 24, done(USH1, { note: "Any 10th grade U.S. History I course." }));
rule("honors-u-s-history-ii", 24, done(USH1, { note: "Any 10th grade U.S. History I course." }));
rule("ap-u-s-history-i", 24, all(done(WORLD, { note: "Any 9th grade World History course." }), manual(REC)));
rule("ap-world-history", 25, manual(REC));
rule("ap-art-history", 25, manual("Recommendation of Social Studies teacher and supervisor"));
// Paired courses (p26-28): each must be taken together with the other.
rule("ap-microeconomics", 26, co(["ap-macroeconomics"], { note: "The PDF says students must also take AP Macroeconomics." }));
rule("ap-macroeconomics", 26, co(["ap-microeconomics"], { note: "Taken as a pair with AP Microeconomics (p26)." }));
rule("an-introduction-to-the-analysis-of-public-policy", [27, 28], co(["ap-american-government-and-politics"], { note: "Taken with AP American Government and Politics." }));
rule("ap-american-government-and-politics", [28, 27], co(["an-introduction-to-the-analysis-of-public-policy"], { note: "Taken with An Introduction to the Analysis of Public Policy." }));

// ---------- Mathematics (p29-34, paths on p37) ----------
const algI8 = "8th grade Algebra I counts as Algebra I here, per the typical path diagram on p37.";
rule("honors-geometry", [29, 38], all(prior("ALGEBRA_I", undefined, { appealable: true, note: "The Honors Program starts with 8th grade Algebra I. Students can move in later (p38)." }), manual("Supervisor placement: 8th grade averages, placement exam, and teacher rubric")));
rule("geometry-enhanced", 30, all(
  any(prior("ALGEBRA_I", "C_PLUS", { note: "Initial test/quiz average of C+ or higher in 8th grade Algebra I." }), prior(undefined, "B_MINUS", { note: "Initial test/quiz average of B- or higher in 8th grade math." })),
  manual(REC),
));
rule("geometry", 30, prior(undefined, "D", { note: "A passing grade in 8th grade math." }));
rule("algebra-i-enhanced", 30, all(any(grade(["geometry-enhanced"], "C_PLUS"), grade(["geometry"], "A")), manual(REC)));
rule("algebra-i", 30, done(["geometry"]));
rule("honors-algebra-ii-with-trigonometry", 30, all(
  any(
    grade(["honors-geometry"], "B"),
    all(
      grade(["geometry-enhanced"], "A"),
      any(grade(["algebra-i-enhanced"], "A"), prior("ALGEBRA_I", "A", { note: algI8 })),
      manual(EXAM, { note: "The PDF's punctuation does not say whether the exam applies to both options. A supervisor should confirm." }),
    ),
  ),
  manual(REC),
));
rule("algebra-ii-with-trigonometry-enhanced", 31, all(
  any(grade(["algebra-i-enhanced"], "C_PLUS"), grade(["algebra-i"], "A"), prior("ALGEBRA_I", "C_PLUS", { note: algI8 })),
  any(grade(["geometry-enhanced"], "C_PLUS"), grade(["geometry"], "A")),
  manual(REC),
));
for (const s of ["algebra-ii-with-trigonometry", "algebra-ii"]) {
  rule(s, 31, any(done(["algebra-i"]), prior("ALGEBRA_I", "D", { note: algI8 })));
}
rule("college-algebra", 31, done(["algebra-ii-with-trigonometry", "algebra-ii-with-trigonometry-enhanced"]));
rule("ap-pre-calculus", 32, all(
  any(grade(["honors-algebra-ii-with-trigonometry"], "B"), all(grade(["algebra-ii-with-trigonometry-enhanced"], "A"), manual(EXAM, { note: "The PDF does not say whether the exam applies to both options. A supervisor should confirm." }))),
  manual(REC),
));
rule("pre-calculus", 32, all(
  any(grade(["algebra-ii-with-trigonometry-enhanced"], "B_MINUS"), all(grade(["college-algebra"], "B_PLUS"), manual(EXAM, { note: "The PDF does not say whether the exam applies to both options. A supervisor should confirm." }))),
  manual(REC),
));
rule("ap-calculus-bc", 32, all(grade(["ap-pre-calculus"], "B_PLUS"), manual(REC)));
rule("ap-calculus-ab", 33, all(
  any(grade(["ap-pre-calculus"], "B_MINUS"), all(grade(["pre-calculus"], "A"), manual(EXAM, { note: "The PDF does not say whether the exam applies to both options. A supervisor should confirm." }))),
  manual(REC),
));
rule("calculus", 33, grade(["pre-calculus"], "B_MINUS"));
rule("advanced-topics-in-calculus-honors", 33, all(done(["ap-calculus-bc"]), manual(REC)));
rule("statistics", 34, done(["algebra-ii-with-trigonometry", "algebra-ii-with-trigonometry-enhanced"]));
rule("ap-statistics", 34, all(
  any(done(["algebra-ii-with-trigonometry-enhanced"]), grade(["college-algebra"], "B_PLUS", "initialAverage", { note: "The PDF is unclear whether the B+ also applies to Algebra II with Trigonometry Enhanced. A supervisor should confirm." })),
  manual(REC),
));
rule("discrete-math", 34, done(["algebra-ii-with-trigonometry"]));

// ---------- Computer science (p35-36) ----------
rule("introduction-to-computer-science-and-app-development", 35, coOrPre(["geometry", "geometry-enhanced"]));
rule("honors-computer-science", 35, all(
  any(
    all(coOrPre(["honors-algebra-ii-with-trigonometry", "algebra-ii-with-trigonometry-enhanced"]), manual("A high level of interest in programming")),
    coOrPre(["introduction-to-computer-science-and-app-development"]),
  ),
  manual(REC),
));
rule("ap-computer-science-a", 35, all(done(["honors-computer-science"]), manual(REC)));
rule("advanced-topics-in-computer-science-honors", 36, all(done(["ap-computer-science-a"]), manual(REC)));

// ---------- Science (p39-45, paths on p46) ----------
rule("honors-biology", 39, coOrPre(["honors-geometry", "geometry-enhanced"], { advisory: true }));
rule("ap-biology", 40, all(
  any(coOrPre(["honors-chemistry"]), coOrPre(["honors-physics"], { note: "The PDF lists Honors Chemistry and Honors Physics together. We accept either." })),
  manual(REC),
));
rule("chemistry", 40, any(coOrPre(["algebra-i"], { advisory: true }), prior("ALGEBRA_I", "D", { advisory: true, note: algI8 })));
rule("chemistry-enhanced", 40, coOrPre(["algebra-i-enhanced"], { advisory: true }));
rule("honors-chemistry", 40, all(
  any(grade(["honors-biology"], "B", "final"), grade(["biology-enhanced"], "A", "final")),
  manual("Math skills placement test, if you have not completed Algebra I"),
  coOrPre(["honors-algebra-ii-with-trigonometry", "algebra-ii-with-trigonometry-enhanced"], { advisory: true }),
));
rule("ap-chemistry", 41, all(
  grade(["honors-chemistry"], "B", "final"),
  coOrPre(["honors-physics", "ap-physics-i"], { note: "Honors Physics or AP Physics I." }),
  manual(REC),
));
rule("physics", 41, coOrPre(["algebra-ii-with-trigonometry"]));
rule("physics-enhanced", 41, coOrPre(["algebra-ii-with-trigonometry-enhanced", "honors-algebra-ii-with-trigonometry"], { advisory: true }));
rule("honors-physics", 41, all(
  any(grade(["honors-chemistry"], "B", "final"), grade(["chemistry-enhanced"], "A", "final")),
  coOrPre(["ap-pre-calculus", "pre-calculus", "calculus"], { advisory: true }),
));
rule("ap-physics-i", 42, all(coOrPre(["ap-pre-calculus", "pre-calculus", ...CALC]), manual(REC)));
rule("applied-physics-and-engineering", 42, manual("The Science listing says Algebra I and the Technology Education listing says Chemistry. Ask the supervisor which applies"));
rule("ap-physics-ii", 42, all(grade(["honors-physics", "ap-physics-i"], "B", "final"), manual(REC)));
rule("ap-physics-c", 42, all(grade(["honors-physics", "ap-physics-i"], "B", "final"), coOrPre(CALC, { note: "Required." }), manual(REC)));
rule("honors-forensic-science", 43, all(done(BIO, { note: "Any Biology course." }), done(CHEM, { note: "Any Chemistry course." }), done(PHYS, { note: "Any Physics course." }), manual(REC)));
rule("honors-research-in-molecular-genetics-i", 43, all(any(done(["honors-biology"]), grade(["biology-enhanced"], "A_MINUS", "final")), manual(REC)));
rule("honors-research-in-molecular-genetics-ii", 44, all(done(["honors-research-in-molecular-genetics-i"]), manual(REC)));
rule("honors-research-in-molecular-genetics-iii", 44, all(done(["honors-research-in-molecular-genetics-i"]), done(["honors-research-in-molecular-genetics-ii"]), manual(REC)));
rule("introduction-to-anatomy-and-physiology", 44, grade(BIO, "C", "final", { note: "A C or better in a biology course." }));
rule("honors-anatomy-and-physiology", 44, all(any(done(["honors-biology"]), grade(["biology-enhanced"], "A_MINUS", "final")), manual(REC)));
rule("ap-environmental-science", 45, all(done(["chemistry", "honors-chemistry"]), coOrPre(["chemistry-enhanced", "physics-enhanced"])));

// ---------- World language (p47-49) ----------
for (const l of ["chinese", "french", "italian", "spanish"]) {
  rule(`ap-${l}-language-and-culture`, 47, manual("Honors language sequence, and recommendation of teacher and supervisor"));
}
rule("ap-spanish-literature-and-culture", [48, 49], all(done(["ap-spanish-language-and-culture", "spanish-for-heritage-speakers-iii"]), manual(REC)));

// ---------- Art, business, family and consumer sciences, music, technology (p49-69) ----------
const PORTFOLIO = "Teacher approved portfolio or recommendation";
rule("honors-advanced-studio-art-ii", 49, all(done(["studio-art-i"]), manual(PORTFOLIO)));
rule("honors-advanced-ceramics-and-sculpture-ii", 50, all(done(["ceramics-and-sculpture-i"]), manual(PORTFOLIO)));
rule("honors-advanced-photography-ii", 51, all(done(["photography-i"]), manual(PORTFOLIO)));
rule("communication-design", 51, any(done(["photography-i"]), manual("Teacher recommendation")));
rule("management-and-leadership", 54, done(inDept("BUSINESS", "management-and-leadership"), { note: "Any one Business course." }));
rule("honors-marketing-and-merchandising", 54, done(["marketing", "principles-of-business"], { note: "Marketing and Principles of Business." }));
rule("culinary-arts-ii", 57, done(["culinary-arts-i"]));
rule("advanced-clothing-construction", 58, done(["clothing-construction"]));
rule("advanced-fashion-design", 58, done(["fashion-design"]));
rule("early-childhood-and-family-education-ii", 59, done(["early-childhood-and-family-education-i"]));
rule("early-childhood-and-family-education-iii", 59, done(["early-childhood-and-family-education-ii"]));
rule("chamber-choir", 62, manual("Audition"));
rule("honors-chamber-choir", 63, manual("Audition"));
rule("honors-concert-band", 63, manual("Audition"));
rule("ap-music-theory", 65, manual(REC));
rule("graphic-design-ii", 66, done(["graphic-design-i"]));
rule("honors-engineering-design-i", 67, any({ type: "gradeLevel", in: [10, 11, 12] }, co(["honors-biology"], { note: "Required for 9th grade students." })));
rule("honors-engineering-design-ii", 67, done(["honors-engineering-design-i"]));
rule("advanced-video-production", 68, all(done(["video-production"]), manual("Teacher recommendation")));
rule("honors-broadcast-television-production", 68, all(done(["video-production"]), manual("Teacher recommendation")));
rule("honors-research-in-innovation-and-design", 69, all(done(inDept("TECHNOLOGY", "honors-research-in-innovation-and-design"), { note: "One or more Technology Education courses." }), manual("Teacher recommendation")));

// ---------- Edges (typical paths: math, computer science p37; science p46) ----------
type Track = "MATH" | "SCIENCE" | "COMPUTER_SCIENCE" | "WORLD_LANGUAGE" | "ENGLISH" | "SOCIAL_STUDIES";
interface Edge {
  from: string;
  to: string;
  track: Track;
  kind: "STANDARD" | "ADVANCE";
  appealable: boolean;
  note?: string;
}
const edges: Edge[] = [];
const edge = (track: Track, kind: Edge["kind"], pairs: [string, string][], note?: string) => {
  for (const [from, to] of pairs) edges.push({ from, to, track, kind, appealable: true, ...(note ? { note } : {}) });
};
const P37 = "Typical Math Paths, p37";
// Two starting points: Algebra I or Pre-Algebra in middle school.
edge("MATH", "STANDARD", [
  ["algebra-i-8th-grade", "honors-geometry"],
  ["algebra-i-8th-grade", "geometry-enhanced"],
  ["pre-algebra-8th-grade", "geometry-enhanced"],
  ["pre-algebra-8th-grade", "geometry"],
], P37);
edge("MATH", "STANDARD", [
  ["honors-geometry", "honors-algebra-ii-with-trigonometry"],
  ["geometry-enhanced", "algebra-ii-with-trigonometry-enhanced"],
  ["geometry-enhanced", "algebra-i-enhanced"],
  ["geometry", "algebra-i"],
  ["algebra-i-enhanced", "algebra-ii-with-trigonometry-enhanced"],
  ["algebra-i", "algebra-ii-with-trigonometry"],
  ["honors-algebra-ii-with-trigonometry", "ap-pre-calculus"],
  ["algebra-ii-with-trigonometry-enhanced", "pre-calculus"],
  ["algebra-ii-with-trigonometry-enhanced", "ap-statistics"],
  ["algebra-ii-with-trigonometry", "college-algebra"],
  ["algebra-ii-with-trigonometry", "statistics"],
  ["algebra-ii-with-trigonometry", "discrete-math"],
  ["ap-pre-calculus", "ap-calculus-bc"],
  ["ap-pre-calculus", "ap-calculus-ab"],
  ["pre-calculus", "calculus"],
  ["ap-calculus-bc", "advanced-topics-in-calculus-honors"],
], P37);
edge("MATH", "ADVANCE", [
  ["geometry-enhanced", "honors-algebra-ii-with-trigonometry"],
  ["algebra-ii-with-trigonometry-enhanced", "ap-pre-calculus"],
  ["geometry", "algebra-i-enhanced"],
  ["algebra-i", "algebra-ii-with-trigonometry-enhanced"],
  ["pre-calculus", "ap-calculus-ab"],
  ["college-algebra", "pre-calculus"],
  ["college-algebra", "ap-statistics"],
], `${P37}. Moving up a level, may need an appeal.`);
edge("COMPUTER_SCIENCE", "STANDARD", [
  ["introduction-to-computer-science-and-app-development", "honors-computer-science"],
  ["honors-computer-science", "ap-computer-science-a"],
  ["ap-computer-science-a", "advanced-topics-in-computer-science-honors"],
], "Typical Comp Sci Paths, p37");
edge("SCIENCE", "STANDARD", [
  ["honors-biology", "honors-chemistry"],
  ["biology-enhanced", "chemistry-enhanced"],
  ["biology", "chemistry"],
  ["honors-chemistry", "honors-physics"],
  ["chemistry-enhanced", "physics-enhanced"],
  ["chemistry", "physics"],
], "Typical Science Paths, p46");
edge("SCIENCE", "ADVANCE", [
  ["biology-enhanced", "honors-chemistry"],
  ["biology", "chemistry-enhanced"],
  ["chemistry-enhanced", "honors-physics"],
  ["chemistry", "physics-enhanced"],
], "Typical Science Paths, p46. Moving up a level, may need supervisor approval.");
// The PDF states no prerequisite for world language levels. These follow the course numbering only.
for (const l of ["chinese", "french", "italian", "spanish"]) {
  edge("WORLD_LANGUAGE", "STANDARD", [
    [`${l}-i`, `${l}-ii`],
    [`${l}-ii`, `${l}-iii`],
    [`${l}-iii`, `${l}-iv`],
    [`${l}-iv`, `${l}-v`],
    [`honors-${l}-ii`, `honors-${l}-iii`],
    [`honors-${l}-iii`, `honors-${l}-iv`],
    [`honors-${l}-iv`, `ap-${l}-language-and-culture`],
  ], "Level order from the course names. The PDF lists no formal prerequisite.");
  edge("WORLD_LANGUAGE", "ADVANCE", [
    [`${l}-i`, `honors-${l}-ii`],
    [`${l}-ii`, `honors-${l}-iii`],
    [`${l}-iii`, `honors-${l}-iv`],
  ], "Moving to the honors level. Honors admission is by self-nomination (p47).");
}
edge("WORLD_LANGUAGE", "STANDARD", [["ap-spanish-language-and-culture", "ap-spanish-literature-and-culture"], ["spanish-for-heritage-speakers-iii", "ap-spanish-literature-and-culture"]], "Prerequisite for AP Spanish Literature, p49.");
edge("ENGLISH", "STANDARD", [
  ["english-i", "english-ii"], ["english-ii", "english-iii"], ["english-iii", "english-iv"],
  ["honors-english-i", "honors-english-ii"], ["honors-english-ii", "honors-english-iii"], ["honors-english-iii", "honors-english-iv"],
  ["ap-capstone-seminar", "ap-capstone-research"],
], "Prerequisite text, p16-18.");
edge("ENGLISH", "ADVANCE", [["english-i", "honors-english-ii"], ["english-ii", "honors-english-iii"], ["english-iii", "honors-english-iv"]], "Moving to the honors level.");
edge("SOCIAL_STUDIES", "STANDARD", [
  ["world-history", "u-s-history-i"], ["u-s-history-i", "u-s-history-ii"],
  ["honors-world-history", "honors-u-s-history-i"], ["honors-u-s-history-i", "honors-u-s-history-ii"],
], "Prerequisite text, p24.");
edge("SOCIAL_STUDIES", "ADVANCE", [["world-history", "honors-u-s-history-i"], ["u-s-history-i", "honors-u-s-history-ii"], ["world-history", "ap-u-s-history-i"]], "Moving to the honors or AP level.");

// ---------- write ----------
const out = (name: string, data: unknown) => writeFileSync(path.join("prisma/seed", name), JSON.stringify(data, null, 2) + "\n");
out("rules.json", Object.entries(R).map(([slug, e]) => ({ slug, ...e })));
out("edges.json", edges);
console.log(`rules: ${Object.keys(R).length}, edges: ${edges.length}`);
