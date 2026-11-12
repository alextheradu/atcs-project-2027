import { describe, expect, it } from "vitest";
import { summarize, type CourseTag, type RequirementKind, type RequirementRuleInput, type TrackedEntry } from "@/lib/requirements";
import { buildBoard, rowFor, spotsFor, statusSentence, type BoardEntry } from "./index";

const RULES: RequirementRuleInput[] = [
  { kind: "ENGLISH", label: "English", requiredCredits: 20 },
  { kind: "PE_HEALTH", label: "Physical Education and Health", requiredCredits: 20 },
  { kind: "MATH", label: "Mathematics", requiredCredits: 15 },
  { kind: "SCI_BIO", label: "Biology", requiredCredits: 5 },
  { kind: "SCI_CHEM", label: "Chemistry", requiredCredits: 5 },
  { kind: "SCI_PHYS", label: "Physics", requiredCredits: 5 },
  { kind: "SOCIAL_STUDIES", label: "Social Studies", requiredCredits: 15 },
  { kind: "ARTS", label: "Visual/Performing Arts", requiredCredits: 5 },
  { kind: "LIFE_CAREERS", label: "21st Century Life and Careers", requiredCredits: 5 },
  { kind: "FIN_LIT", label: "Financial Literacy", requiredCredits: 2.5 },
  { kind: "WORLD_LANG", label: "World Language", requiredCredits: 10 },
];

const tag = (kind: RequirementKind, credits = 5): CourseTag => ({ kind, credits, provisional: false });

let n = 0;
interface Fixture extends BoardEntry, TrackedEntry {}
const course = (gradeLevel: number, tags: CourseTag[], credits = 5, name = `Course ${++n}`): Fixture => ({
  id: `e${++n}`, name, gradeLevel, tags, credits, courseCredits: credits, status: "PLANNED",
});
const summaryOf = (entries: Fixture[], rules = RULES) => summarize(entries, rules);
const only = (kind: RequirementKind, required: number): RequirementRuleInput[] => [{ kind, label: kind, requiredCredits: required }];

/** Every requirement met, so tests can switch one area off at a time. */
function fullPlan(): Fixture[] {
  return [
    ...[9, 10, 11, 12].map((g) => course(g, [tag("ENGLISH")])),
    ...[9, 10, 11, 12].map((g) => course(g, [tag("PE_HEALTH")])),
    ...[9, 10, 11].map((g) => course(g, [tag("MATH")])),
    course(9, [tag("SCI_BIO")]), course(10, [tag("SCI_CHEM")]), course(11, [tag("SCI_PHYS")]),
    ...[9, 10, 11].map((g) => course(g, [tag("SOCIAL_STUDIES")])),
    course(10, [tag("ARTS")]), course(11, [tag("LIFE_CAREERS")]), course(12, [tag("FIN_LIT", 2.5)], 2.5),
    course(9, [tag("WORLD_LANG")]), course(10, [tag("WORLD_LANG")]),
  ];
}

describe("rowFor", () => {
  it("puts a course with no requirement tags in Electives", () => {
    expect(rowFor([])).toBe("elective");
  });
  it("uses the tag worth the most credits", () => {
    expect(rowFor([tag("ARTS", 2.5), tag("MATH", 5)])).toBe("math");
  });
  it("breaks a tie by row order, so American Studies sits in English", () => {
    expect(rowFor([tag("SOCIAL_STUDIES"), tag("ENGLISH")])).toBe("english");
  });
  it("groups the three sciences into one row", () => {
    expect(rowFor([tag("SCI_CHEM")])).toBe("science");
  });
});

describe("spotsFor", () => {
  it("splits 15 missing math credits into 3 spots of 5", () => {
    const spots = spotsFor(summaryOf([], only("MATH", 15)), [], 9);
    expect(spots.map((s) => [s.kind, s.credits])).toEqual([["MATH", 5], ["MATH", 5], ["MATH", 5]]);
  });
  it("makes one 2.5 credit spot for Financial Literacy", () => {
    const spots = spotsFor(summaryOf([], only("FIN_LIT", 2.5)), [], 9);
    expect(spots).toHaveLength(1);
    expect(spots[0].credits).toBe(2.5);
    expect(spots[0].row).toBe("finlit");
  });
  it("rounds 7.5 missing credits up to 2 spots", () => {
    const e = [course(9, [tag("ENGLISH", 2.5)], 2.5)];
    const spots = spotsFor(summaryOf(e, only("ENGLISH", 10)), e, 9);
    expect(spots).toHaveLength(2);
    expect(spots.map((s) => s.credits)).toEqual([5, 2.5]);
  });
  it("labels science spots by which science is missing", () => {
    const spots = spotsFor(summaryOf([], only("SCI_PHYS", 5)), [], 9);
    expect(spots[0]).toMatchObject({ row: "science", kind: "SCI_PHYS", label: "Pick a physics class" });
  });
  it("uses 'an' before a vowel", () => {
    expect(spotsFor(summaryOf([], only("ENGLISH", 5)), [], 9)[0].label).toBe("Pick an English class");
  });
  it("never places a spot before the student's current grade", () => {
    const spots = spotsFor(summaryOf([], only("ENGLISH", 10)), [], 11);
    expect(spots.map((s) => s.gradeLevel)).toEqual([11, 12]);
  });
  it("skips grades that already have a class in that row", () => {
    const e = [course(9, [tag("PE_HEALTH")]), course(11, [tag("PE_HEALTH")])];
    const spots = spotsFor(summaryOf(e, only("PE_HEALTH", 20)), e, 9);
    expect(spots.map((s) => s.gradeLevel)).toEqual([10, 12]);
  });
  it("stacks extra spots in 12th grade and drops none", () => {
    const spots = spotsFor(summaryOf([], only("MATH", 15)), [], 12);
    expect(spots.map((s) => s.gradeLevel)).toEqual([12, 12, 12]);
  });
  it("starts at 9th grade when the current grade is unknown", () => {
    const spots = spotsFor(summaryOf([], only("WORLD_LANG", 10)), [], null);
    expect(spots.map((s) => s.gradeLevel)).toEqual([9, 10]);
  });
  it("fills one row's open columns in order across its kinds", () => {
    const rules = [...only("SCI_BIO", 5), ...only("SCI_CHEM", 5)];
    const spots = spotsFor(summaryOf([], rules), [], 10);
    expect(spots.map((s) => [s.kind, s.gradeLevel])).toEqual([["SCI_BIO", 10], ["SCI_CHEM", 11]]);
  });
  it("makes no spots for the credit total or the per-year minimums", () => {
    const e = fullPlan();
    const s = summaryOf(e);
    expect(s.kinds.every((k) => k.met)).toBe(true);
    expect(s.missing).toBeGreaterThan(0);
    expect(spotsFor(s, e, 9)).toEqual([]);
  });
});

describe("buildBoard", () => {
  it("puts each entry in exactly one cell", () => {
    const e = [...fullPlan(), course(12, []), course(11, [tag("SOCIAL_STUDIES"), tag("ENGLISH")])];
    const rows = buildBoard(e, summaryOf(e), 9);
    const placed = rows.flatMap((r) => [9, 10, 11, 12].flatMap((g) => r.cells[g as 9].entryIds));
    expect(placed.sort()).toEqual(e.map((x) => x.id).sort());
  });
  it("lists every row in a fixed order", () => {
    const rows = buildBoard([], summaryOf([]), 9);
    expect(rows.map((r) => r.key)).toEqual(["english", "math", "science", "social", "language", "pe", "arts", "life", "finlit", "elective"]);
  });
  it("puts spots in the cell they were placed in", () => {
    const rows = buildBoard([], summaryOf([], only("MATH", 10)), 11);
    const math = rows.find((r) => r.key === "math")!;
    expect(math.cells[11].spots).toHaveLength(1);
    expect(math.cells[12].spots).toHaveLength(1);
    expect(math.cells[9].spots).toHaveLength(0);
  });
  it("says Done for a met row and how many are left otherwise", () => {
    const e = fullPlan().filter((x) => !x.tags.some((t) => t.kind === "SCI_PHYS"));
    const rows = buildBoard(e, summaryOf(e), 9);
    expect(rows.find((r) => r.key === "english")!.status).toBe("Covered");
    expect(rows.find((r) => r.key === "science")!.status).toBe("1 class to add");
  });
});

describe("statusSentence", () => {
  it("counts empty spots", () => {
    const e = [...Array.from({ length: 18 }, () => course(9, [])), course(10, [], 2.5)];
    const s = summaryOf(e);
    expect(statusSentence(s, 3)).toBe("92.5 of 120 credits. 3 empty spots left to graduate.");
  });
  it("uses the singular for one spot", () => {
    expect(statusSentence(summaryOf([]), 1)).toBe("0 of 120 credits. 1 empty spot left to graduate.");
  });
  it("asks for more credits when every area is covered but the total is short", () => {
    const e = fullPlan();
    const s = summaryOf(e);
    expect(statusSentence(s, 0)).toBe(`${s.total} of 120 credits. Add ${s.missing} more credits of any classes to graduate.`);
  });
  it("says so when everything is done", () => {
    const e = [...fullPlan(), ...Array.from({ length: 10 }, () => course(12, []))];
    const s = summaryOf(e);
    expect(s.complete).toBe(true);
    expect(statusSentence(s, 0)).toBe(`${s.total} of 120 credits. You have everything you need to graduate.`);
  });
});
