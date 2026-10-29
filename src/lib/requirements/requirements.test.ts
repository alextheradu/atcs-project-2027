import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  summarize,
  tagContribution,
  type RequirementRuleInput,
  type TrackedEntry,
} from "./index";

const RULES: RequirementRuleInput[] = [
  { kind: "ENGLISH", label: "English", requiredCredits: 20 },
  { kind: "PE_HEALTH", label: "PE and Health", requiredCredits: 20 },
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

let n = 0;
const entry = (over: Partial<TrackedEntry> & Pick<TrackedEntry, "tags">): TrackedEntry => ({
  id: `e${++n}`,
  gradeLevel: 9,
  status: "PLANNED",
  credits: 5,
  courseCredits: 5,
  ...over,
});
const tag = (kind: string, credits = 5, provisional = false) => ({ kind: kind as never, credits, provisional });
const get = (s: ReturnType<typeof summarize>, kind: string) => s.kinds.find((k) => k.kind === kind)!;

describe("tagContribution", () => {
  it("a full tag counts the credits the student actually has", () => {
    expect(tagContribution(entry({ credits: 6, courseCredits: 5, tags: [] }), tag("SCI_BIO", 5))).toBe(6);
  });
  it("a partial tag counts only its own credits", () => {
    expect(tagContribution(entry({ credits: 10, courseCredits: 10, tags: [] }), tag("SCI_PHYS", 5))).toBe(5);
  });
});

describe("summarize", () => {
  it("starts empty with everything missing", () => {
    const s = summarize([], RULES);
    expect(s.total).toBe(0);
    expect(s.missing).toBe(120);
    expect(s.complete).toBe(false);
    expect(s.kinds).toHaveLength(11);
    expect(get(s, "ENGLISH")).toMatchObject({ required: 20, earned: 0, scheduled: 0, missing: 20, met: false });
  });

  it("splits completed from planned and in progress", () => {
    const s = summarize(
      [
        entry({ status: "COMPLETED", tags: [tag("MATH")] }),
        entry({ status: "IN_PROGRESS", tags: [tag("MATH")] }),
        entry({ status: "PLANNED", tags: [tag("MATH")] }),
      ],
      RULES,
    );
    expect(get(s, "MATH")).toMatchObject({ earned: 5, scheduled: 10, total: 15, missing: 0, met: true });
  });

  it("American Studies counts toward English and Social Studies", () => {
    const s = summarize(
      [entry({ gradeLevel: 11, credits: 10, courseCredits: 10, tags: [tag("ENGLISH"), tag("SOCIAL_STUDIES")] })],
      RULES,
    );
    expect(get(s, "ENGLISH").total).toBe(5);
    expect(get(s, "SOCIAL_STUDIES").total).toBe(5);
    expect(s.total).toBe(10);
  });

  it("engineering physics courses satisfy physics", () => {
    const s = summarize(
      [entry({ gradeLevel: 11, credits: 10, courseCredits: 10, tags: [tag("SCI_PHYS", 5)] })],
      RULES,
    );
    expect(get(s, "SCI_PHYS")).toMatchObject({ total: 5, met: true });
    expect(s.total).toBe(10);
  });

  it("a half-year financial literacy course meets its 2.5 credits", () => {
    const s = summarize([entry({ credits: 2.5, courseCredits: 2.5, tags: [tag("FIN_LIT", 2.5)] })], RULES);
    expect(get(s, "FIN_LIT")).toMatchObject({ total: 2.5, missing: 0, met: true });
  });

  it("two half-year courses add up exactly", () => {
    const s = summarize(
      [
        entry({ credits: 2.5, courseCredits: 2.5, tags: [tag("SOCIAL_STUDIES", 2.5)] }),
        entry({ credits: 2.5, courseCredits: 2.5, tags: [tag("SOCIAL_STUDIES", 2.5)] }),
      ],
      RULES,
    );
    expect(get(s, "SOCIAL_STUDIES").total).toBe(5);
  });

  it("provisional tags count but are flagged", () => {
    const s = summarize([entry({ tags: [tag("ARTS", 5, true)] })], RULES);
    expect(get(s, "ARTS")).toMatchObject({ total: 5, met: true, provisional: 5 });
  });

  it("an honors science entry with 6 earned credits counts 6", () => {
    const s = summarize([entry({ status: "COMPLETED", credits: 6, courseCredits: 5, tags: [tag("SCI_BIO")] })], RULES);
    expect(get(s, "SCI_BIO")).toMatchObject({ earned: 6, missing: 0 });
  });

  it("excess credits never produce a negative missing", () => {
    const s = summarize(
      [entry({ credits: 15, courseCredits: 15, tags: [tag("LIFE_CAREERS", 15, true)] })],
      RULES,
    );
    expect(get(s, "LIFE_CAREERS").missing).toBe(0);
  });

  it("thresholds are editable", () => {
    const rules = RULES.map((r) => (r.kind === "MATH" ? { ...r, requiredCredits: 20 } : r));
    const s = summarize([entry({ tags: [tag("MATH")] })], rules);
    expect(get(s, "MATH")).toMatchObject({ required: 20, missing: 15 });
    const s2 = summarize([], RULES, { ...DEFAULT_SETTINGS, totalRequired: 100 });
    expect(s2.totalRequired).toBe(100);
    expect(s2.missing).toBe(100);
  });

  it("tracks credits per year", () => {
    const s = summarize(
      [entry({ gradeLevel: 9, tags: [] }), entry({ gradeLevel: 9, tags: [] }), entry({ gradeLevel: 12, status: "COMPLETED", tags: [] })],
      RULES,
    );
    expect(s.years.map((y) => [y.grade, y.total])).toEqual([[9, 10], [10, 0], [11, 0], [12, 5]]);
    expect(s.years[3]).toMatchObject({ earned: 5, scheduled: 0 });
  });

  it("lists what is missing, biggest gap first, skipping met requirements", () => {
    const s = summarize([entry({ tags: [tag("MATH", 5)] }), entry({ tags: [tag("ENGLISH", 5)] })], RULES);
    expect(s.missingList[0]).toMatchObject({ kind: "PE_HEALTH", missing: 20 });
    expect(s.missingList[1]).toMatchObject({ kind: "ENGLISH", missing: 15 });
    expect(s.missingList.map((m) => m.missing)).toEqual([...s.missingList.map((m) => m.missing)].sort((a, b) => b - a));
    const met = summarize(Array.from({ length: 3 }, () => entry({ tags: [tag("MATH", 5)] })), RULES);
    expect(met.missingList.map((m) => m.kind)).not.toContain("MATH");
  });

  it("is complete only when every requirement and the 120 total are met", () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) => entry({ gradeLevel: 9 + i, tags: [tag("ENGLISH")] })),
      ...Array.from({ length: 4 }, (_, i) => entry({ gradeLevel: 9 + i, tags: [tag("PE_HEALTH")] })),
      ...Array.from({ length: 3 }, () => entry({ tags: [tag("MATH")] })),
      entry({ tags: [tag("SCI_BIO")] }),
      entry({ tags: [tag("SCI_CHEM")] }),
      entry({ tags: [tag("SCI_PHYS")] }),
      ...Array.from({ length: 3 }, () => entry({ tags: [tag("SOCIAL_STUDIES")] })),
      entry({ tags: [tag("ARTS")] }),
      entry({ tags: [tag("LIFE_CAREERS")] }),
      entry({ credits: 2.5, courseCredits: 2.5, tags: [tag("FIN_LIT", 2.5)] }),
      ...Array.from({ length: 2 }, () => entry({ tags: [tag("WORLD_LANG")] })),
    ];
    const s = summarize(entries, RULES);
    expect(s.kinds.every((k) => k.met)).toBe(true);
    expect(s.total).toBeLessThan(120);
    expect(s.complete).toBe(false);
    const padded = [...entries, ...Array.from({ length: 12 }, () => entry({ tags: [] }))];
    expect(summarize(padded, RULES).complete).toBe(true);
  });
});
