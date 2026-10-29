/**
 * Rule based starter Plan A for 9th grade. Deterministic, no AI. It is a draft built from
 * self-reported answers, never a placement. Pure.
 */
import { gradeAtLeast, type Grade } from "@/lib/eligibility/grades";

export interface StarterCourse {
  id: string;
  slug: string;
  name: string;
  level: string;
  credits: number;
  gradesOffered: number[];
  interests: string[];
  kinds: string[];
  hasPrereq: boolean;
  plannable: boolean;
}

export interface StarterInput {
  interests: string[];
  eighthMath?: "ALGEBRA_I" | "PRE_ALGEBRA" | "UNSURE" | null;
  mathGrade?: Grade | null;
  scienceGrade?: Grade | null;
  englishGrade?: Grade | null;
  historyGrade?: Grade | null;
  language?: { name: "chinese" | "french" | "italian" | "spanish"; level: number } | null;
}

export type Fit = "likely a fit" | "worth considering, a supervisor decides";

export interface StarterPick {
  courseId: string;
  slug: string;
  name: string;
  role: "required" | "elective";
  fit: Fit;
  reason: string;
}

export interface StarterPlan {
  /** Always shown with the picks. */
  label: "Based on self-reported info";
  picks: StarterPick[];
  /** Higher level options a student may raise with a supervisor. Not in the plan. */
  stretch: StarterPick[];
  credits: number;
}

const REQUIRED = ["ENGLISH", "SOCIAL_STUDIES", "SCI_BIO", "MATH", "PE_HEALTH", "WORLD_LANG"] as const;
/** The six required courses are already 30 credits. Electives bring a 9th grade year to 35 to 40. */
const MIN_CREDITS = 35;
const MAX_CREDITS = 40;
const LEVEL_ORDER: Record<string, number> = { CP: 0, ENHANCED: 1, HONORS: 2 };
const ROMAN = ["", "i", "ii", "iii", "iv", "v"];

const byName = (a: StarterCourse, b: StarterCourse) => a.name.localeCompare(b.name);
const strong = (g: Grade | null | undefined) => !!g && gradeAtLeast(g, "A_MINUS") === true;

function offered(c: StarterCourse) {
  return c.plannable && c.gradesOffered.includes(9);
}

function requiredFor(kind: (typeof REQUIRED)[number], all: StarterCourse[], input: StarterInput): StarterCourse | null {
  const pool = all.filter((c) => offered(c) && c.kinds.includes(kind) && c.level === "CP").sort(byName);
  if (kind === "WORLD_LANG") {
    const lang = input.language;
    if (lang) {
      // Continue the language they studied: the next level up, else the highest available.
      const want = `${lang.name}-${ROMAN[Math.min(lang.level + 1, 5)]}`;
      const hit = pool.find((c) => c.slug === want) ?? pool.filter((c) => c.slug.startsWith(`${lang.name}-`)).pop();
      if (hit) return hit;
    }
    // No language given: show the first beginner course. The pick says so, the student chooses.
    return pool.find((c) => c.slug.endsWith("-i") && !c.slug.includes("heritage")) ?? null;
  }
  // Geometry is the 9th grade math course on both 8th grade paths (page 37 diagram).
  if (kind === "MATH") return pool.find((c) => c.slug === "geometry") ?? pool.find((c) => c.slug.includes("geometry")) ?? null;
  return pool.find((c) => !c.name.toLowerCase().includes("themes")) ?? pool[0] ?? null;
}

/** A higher level course in the same subject worth raising with a supervisor. */
function stretchFor(kind: (typeof REQUIRED)[number], base: StarterCourse, all: StarterCourse[], input: StarterInput): StarterCourse | null {
  const grade = kind === "ENGLISH" ? input.englishGrade : kind === "SOCIAL_STUDIES" ? input.historyGrade : kind === "SCI_BIO" ? input.scienceGrade : kind === "MATH" ? input.mathGrade : null;
  if (!strong(grade)) return null;
  if (kind === "MATH" && input.eighthMath !== "ALGEBRA_I") return null;
  return (
    all
      .filter((c) => offered(c) && c.kinds.includes(kind) && (LEVEL_ORDER[c.level] ?? -1) > LEVEL_ORDER[base.level] && c.level !== "AP")
      .filter((c) => !(kind === "MATH" && c.slug.includes("algebra-ii")))
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || byName(a, b))[0] ?? null
  );
}

export function buildStarterPlan(courses: StarterCourse[], input: StarterInput): StarterPlan {
  const picks: StarterPick[] = [];
  const stretch: StarterPick[] = [];
  let credits = 0;
  const used = new Set<string>();

  for (const kind of REQUIRED) {
    const c = requiredFor(kind, courses, input);
    if (!c) continue;
    used.add(c.id);
    credits += c.credits;
    const guessed = kind === "WORLD_LANG" && !input.language;
    picks.push({
      courseId: c.id, slug: c.slug, name: c.name, role: "required",
      fit: guessed ? "worth considering, a supervisor decides" : "likely a fit",
      reason: guessed ? "Pick the language you want to study. This is only the first beginner course." : "Required in 9th grade or early in the sequence.",
    });
    const s = stretchFor(kind, c, courses, input);
    if (s) {
      stretch.push({ courseId: s.id, slug: s.slug, name: s.name, role: "required", fit: "worth considering, a supervisor decides", reason: `You reported a strong grade. This is a higher level option than ${c.name}.` });
    }
  }

  const wanted = new Set(input.interests);
  const electives = courses
    .filter((c) => offered(c) && !used.has(c.id) && c.level === "CP" && !c.hasPrereq && !c.kinds.some((k) => (REQUIRED as readonly string[]).includes(k)))
    .map((c) => ({ c, overlap: c.interests.filter((i) => wanted.has(i)).length }))
    .sort((a, b) => b.overlap - a.overlap || byName(a.c, b.c));

  for (const { c, overlap } of electives) {
    if (credits + c.credits > MAX_CREDITS) continue;
    // Past the minimum, only add what matches an interest.
    if (credits >= MIN_CREDITS && overlap === 0) break;
    credits += c.credits;
    picks.push({
      courseId: c.id, slug: c.slug, name: c.name, role: "elective",
      fit: overlap > 0 ? "likely a fit" : "worth considering, a supervisor decides",
      reason: overlap > 0 ? "Matches an interest you picked." : "Fills out the year.",
    });
  }

  return { label: "Based on self-reported info", picks, stretch, credits };
}
