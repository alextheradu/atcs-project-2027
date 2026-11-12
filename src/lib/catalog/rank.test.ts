import { describe, expect, it } from "vitest";
import { rankByQuery, searchRank } from "./rank";

const c = (name: string, department = "X", description = "") => ({ name, department, description });

describe("searchRank", () => {
  it("ranks title prefix, title word, title substring, then description", () => {
    expect(searchRank(c("Engineering Design"), "engineering")).toBe(0);
    expect(searchRank(c("Honors Engineering"), "engineering")).toBe(1);
    expect(searchRank(c("Bioengineering"), "engineering")).toBe(2);
    expect(searchRank(c("English 9", "X", "Reading about engineering"), "engineering")).toBe(3);
  });
  it("is case-insensitive and trims the query", () => {
    expect(searchRank(c("Honors ENGINEERING"), "  Engineering ")).toBe(1);
  });
});

describe("rankByQuery", () => {
  const english = c("English 9", "ENGLISH", "Includes a unit on engineering ethics.");
  const tech = c("Honors Engineering", "TECH");
  const techDesc = c("Robotics", "TECH", "Applied engineering.");
  const art = c("Art", "ART", "Engineering of color.");

  it("puts subjects with a title match before subjects with only description matches", () => {
    const groups = rankByQuery([art, english, techDesc, tech], "engineering");
    expect(groups.map(([d]) => d)).toEqual(["TECH", "ART", "ENGLISH"]);
  });
  it("puts title matches first inside a subject", () => {
    const groups = rankByQuery([techDesc, tech], "engineering");
    expect(groups[0][1].map((r) => r.name)).toEqual(["Honors Engineering", "Robotics"]);
  });
  it("keeps the incoming order with no query", () => {
    const groups = rankByQuery([art, english, tech, techDesc], "");
    expect(groups.map(([d]) => d)).toEqual(["ART", "ENGLISH", "TECH"]);
    expect(groups[2][1].map((r) => r.name)).toEqual(["Honors Engineering", "Robotics"]);
  });
});
