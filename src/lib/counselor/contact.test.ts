import { describe, expect, it } from "vitest";
import { hillsCounselorForName } from "./contact";

describe("Pascack Hills counselor contact", () => {
  it.each(["Jordan Parker", "  Jordan   patel ", "Jordan Park Jr.", "Jordan P."])("routes %s to Marin Donnelly", (name) => {
    expect(hillsCounselorForName(name)?.email).toBe("mdonnelly@pascack.org");
  });

  it.each([null, "", "Parker", "Parker Jordan", "Jordan Reed"])("falls back to the directory for %s", (name) => {
    expect(hillsCounselorForName(name)).toBeNull();
  });
});
