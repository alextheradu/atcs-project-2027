import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");

describe("design system stylesheet", () => {
  it("keeps every shared class the UI relies on", () => {
    for (const cls of [
      ".btn", ".btn-primary", ".btn-ghost", ".btn-danger", ".btn-sm", ".btn-lg", ".btn-icon",
      ".list", ".list-hover", ".row-selected", ".input", ".badge", ".badge-eligible", ".badge-locked",
      ".auth-texture", ".grid-backdrop", ".star-border", ".num", ".eyebrow", ".page-enter", ".hero-in", ".skip-link",
    ]) {
      expect(css, cls).toContain(`${cls} `);
    }
  });
  it("has balanced braces", () => {
    let depth = 0;
    for (const ch of css) depth += ch === "{" ? 1 : ch === "}" ? -1 : 0;
    expect(depth).toBe(0);
  });
  it("never uses a colored side stripe or a pure blue surface", () => {
    expect(css).not.toMatch(/border-left:\s*[2-9]px/);
    expect(css).not.toMatch(/inset\s+[2-9]px\s+0\s+0\s+0\s+var\(--accent\)/);
  });
  it("buttons keep the hard lip and no rotation", () => {
    expect(css).toMatch(/box-shadow:\s*0 3px 0 var\(--accent-lip\)/);
    expect(css).not.toMatch(/\.btn[^{]*\{[^}]*rotate\(/);
  });
});
