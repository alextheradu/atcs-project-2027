import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");

describe("design system stylesheet", () => {
  it("keeps every shared class the UI relies on", () => {
    for (const cls of [
      ".btn", ".btn-primary", ".btn-ghost", ".btn-danger", ".btn-sm", ".btn-lg", ".btn-icon",
      ".list", ".list-hover", ".row-selected", ".input", ".badge", ".badge-eligible", ".badge-locked",
      ".star-border", ".num", ".eyebrow", ".page-enter", ".skip-link", ".tile", ".tile-empty", ".soft",
    ]) {
      expect(css, cls).toContain(`${cls} `);
    }
  });
  it("has balanced braces", () => {
    let depth = 0;
    for (const ch of css) depth += ch === "{" ? 1 : ch === "}" ? -1 : 0;
    expect(depth).toBe(0);
  });
  it("uses the neutral palette and Figtree, no mono", () => {
    expect(css).toMatch(/--bg:\s*#161616/);
    expect(css).toMatch(/--accent:\s*#2f6fe4/);
    expect(css).not.toMatch(/#12110f|#1b1a17|Plex/i);
    expect(css).not.toMatch(/font-family:[^;]*mono/i);
  });
  it("has no gradients or blur", () => {
    expect(css).not.toMatch(/gradient\(/);
    expect(css).not.toMatch(/backdrop-filter/);
  });
  it("primary button has the 4px lip and press", () => {
    expect(css).toMatch(/box-shadow:\s*0 4px 0 var\(--accent-lip\)/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });
  it("defines every subject color", () => {
    for (const k of ["english", "math", "science", "social", "language", "pe", "arts", "life", "finlit", "elective"]) {
      expect(css).toContain(`--subject-${k}:`);
      expect(css).toContain(`--subject-${k}-ink:`);
    }
  });
  it("exposes every fill step to Tailwind, so bg-fill-3 exists", () => {
    const theme = css.slice(css.indexOf("@theme inline"), css.indexOf("}", css.indexOf("@theme inline")));
    for (const t of ["fill", "fill-2", "fill-3"]) expect(theme, t).toContain(`--color-${t}:`);
  });
  it("never uses a colored side stripe", () => {
    expect(css).not.toMatch(/border-left:\s*[2-9]px/);
  });
});
