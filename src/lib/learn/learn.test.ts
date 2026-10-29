import { describe, expect, it } from "vitest";
import { HINTS, LEARN_CARDS } from "./content";

describe("learn cards", () => {
  it("has the five basics in order", () => {
    expect(LEARN_CARDS.map((c) => c.id)).toEqual(["credits", "graduation", "levels", "pathways", "appeals"]);
  });
  it("every hint is one short sentence and nothing uses a dash", () => {
    for (const c of LEARN_CARDS) {
      expect(c.hint.length).toBeLessThan(160);
      expect(HINTS[c.id]).toBe(c.hint);
      expect(JSON.stringify(c).includes(String.fromCharCode(0x2014))).toBe(false);
    }
  });
});
