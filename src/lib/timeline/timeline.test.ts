import { describe, expect, it } from "vitest";
import { countdownText, upcoming, type TimelineItem } from "./index";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const ev = (id: string, audience: TimelineItem["audience"], opens: string, closes: string | null = null): TimelineItem => ({ id, kind: "OTHER", audience, label: id, opensAt: d(opens), closesAt: closes ? d(closes) : null });
const now = d("2027-02-10");

describe("upcoming", () => {
  const events = [ev("past", "ALL", "2027-01-01", "2027-01-20"), ev("window", "ALL", "2027-02-01", "2027-02-20"), ev("soon", "CURRENT", "2027-02-15"), ev("kids", "INCOMING", "2027-02-12", "2027-03-01"), ev("far", "ALL", "2027-06-01")];

  it("drops finished dates and orders the rest by the date that matters", () => {
    expect(upcoming(events, "STUDENT", now).map((u) => u.id)).toEqual(["soon", "window", "far"]);
  });
  it("counts an open window down to its close", () => {
    const w = upcoming(events, "STUDENT", now).find((u) => u.id === "window")!;
    expect(w).toMatchObject({ phase: "closes", days: 10 });
  });
  it("filters by audience", () => {
    expect(upcoming(events, "INCOMING", now).map((u) => u.id)).toEqual(["kids", "window", "far"]);
    expect(upcoming(events, "STUDENT", now).map((u) => u.id)).not.toContain("kids");
    expect(upcoming(events, "COUNSELOR", now)).toHaveLength(4);
  });
  it("limits the list", () => {
    expect(upcoming(events, "COUNSELOR", now, 2)).toHaveLength(2);
  });
  it("a single date with no end is due, not opening", () => {
    expect(upcoming(events, "STUDENT", now)[0]).toMatchObject({ id: "soon", phase: "due" });
  });
});

describe("countdownText", () => {
  it("reads naturally", () => {
    expect(countdownText({ phase: "closes", days: 0 })).toBe("Closes today");
    expect(countdownText({ phase: "opens", days: 1 })).toBe("Opens tomorrow");
    expect(countdownText({ phase: "due", days: 12 })).toBe("Due in 12 days");
  });
});
