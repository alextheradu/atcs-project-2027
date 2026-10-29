import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXPORT_KEYS, USER_COLUMN_PATTERN, USER_REFS } from "./registry";

const schema = readFileSync(path.resolve(__dirname, "../../../prisma/schema.prisma"), "utf8");

interface Found { key: string; relation: boolean; onDelete?: string }

/** Every column in the schema that points at a user: a relation to User, or a plain id column named like one. */
function userColumns(): Found[] {
  const out: Found[] = [];
  for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, model, body] = m;
    if (model === "User") continue;
    const relationFields = new Set<string>();
    for (const line of body.split("\n")) {
      const rel = line.match(/^\s*\w+\s+User\??\s+@relation\(([^)]*)\)/);
      if (!rel) continue;
      const field = rel[1].match(/fields:\s*\[(\w+)\]/)?.[1];
      if (!field) continue;
      relationFields.add(field);
      out.push({ key: `${model}.${field}`, relation: true, onDelete: rel[1].match(/onDelete:\s*(\w+)/)?.[1] });
    }
    for (const line of body.split("\n")) {
      const col = line.match(/^\s*(\w+)\s+String\??/)?.[1];
      if (col && USER_COLUMN_PATTERN.test(col) && !relationFields.has(col)) out.push({ key: `${model}.${col}`, relation: false });
    }
  }
  return out;
}

describe("user data registry", () => {
  const found = userColumns();

  it("finds the user columns in the schema", () => {
    expect(found.length).toBeGreaterThan(15);
    expect(found.map((f) => f.key)).toContain("Plan.ownerId");
    expect(found.map((f) => f.key)).toContain("ImportRequest.decidedById");
  });

  it("handles every column that points at a user (add new ones to USER_REFS)", () => {
    const missing = found.map((f) => f.key).filter((k) => !(k in USER_REFS));
    expect(missing).toEqual([]);
  });

  it("has no stale entries", () => {
    const keys = new Set(found.map((f) => f.key));
    expect(Object.keys(USER_REFS).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("matches the database action to the declared handling, so the delete cannot be blocked", () => {
    for (const f of found) {
      const ref = USER_REFS[f.key];
      if (!ref) continue;
      if (f.relation) {
        expect(f.onDelete, `${f.key} needs an explicit onDelete`).toBeDefined();
        expect(f.onDelete, f.key).toBe(ref.how === "cascade" ? "Cascade" : "SetNull");
      } else {
        expect(ref.how, `${f.key} has no foreign key, so it must be scrubbed by hand`).toBe("scrub");
      }
    }
  });

  it("reports every entry in a known export section", () => {
    for (const [k, ref] of Object.entries(USER_REFS)) expect(EXPORT_KEYS, k).toContain(ref.export);
  });

  it("uses every export section", () => {
    const used = new Set(Object.values(USER_REFS).map((r) => r.export));
    for (const k of EXPORT_KEYS) {
      if (k === "account") continue; // the User row itself
      expect(used.has(k), `${k} is never produced by a registry entry`).toBe(true);
    }
  });
});
