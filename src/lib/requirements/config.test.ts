import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./index";
import { parseSettings } from "./config";

describe("parseSettings", () => {
  it("uses defaults for nothing, garbage, or the wrong shape", () => {
    for (const v of [undefined, null, "x", 5, [], {}]) expect(parseSettings(v)).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps valid numbers and replaces invalid ones individually", () => {
    expect(parseSettings({ totalRequired: 130, minPerYear: -3, minFinalYear: "25", maxPeriodsPerYear: 7 })).toEqual({
      totalRequired: 130,
      minPerYear: DEFAULT_SETTINGS.minPerYear,
      minFinalYear: DEFAULT_SETTINGS.minFinalYear,
      maxPeriodsPerYear: 7,
    });
  });
});
