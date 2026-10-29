import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ list: [] as { model: string; op: string; args: unknown }[] }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get: (_t, model: string) => new Proxy({}, {
      get: (_u, op: string) => async (args: unknown) => {
        calls.list.push({ model, op, args });
        return op === "findMany" ? [] : op === "count" ? 0 : null;
      },
    }),
  }),
}));

import { EXPORT_KEYS } from "@/lib/deletion/registry";
import { buildExport } from "./index";

const mentions = (v: unknown, id: string): boolean => JSON.stringify(v).includes(`"${id}"`);

beforeEach(() => { calls.list.length = 0; });

describe("buildExport", () => {
  it("has a section for every export key", async () => {
    const out = await buildExport("u1", new Date("2026-11-01T00:00:00Z"));
    for (const k of EXPORT_KEYS) expect(out, k).toHaveProperty(k);
    expect(out.exportedAt).toBe("2026-11-01T00:00:00.000Z");
  });
  it("scopes every query to the one user, so another person's rows cannot appear", async () => {
    await buildExport("u-target");
    expect(calls.list.length).toBeGreaterThan(15);
    for (const c of calls.list) {
      const where = (c.args as { where?: unknown }).where;
      expect(mentions(where, "u-target"), `${c.model}.${c.op} is not scoped to the user`).toBe(true);
    }
  });
  it("only reads, never writes", async () => {
    await buildExport("u1");
    for (const c of calls.list) expect(["findMany", "findUnique", "count"]).toContain(c.op);
  });
  it("never selects secrets", async () => {
    await buildExport("u1");
    const text = JSON.stringify(calls.list.map((c) => c.args));
    for (const secret of ["access_token", "refresh_token", "id_token", "sessionToken", "p256dh", '"auth":true', "token_type"]) expect(text).not.toContain(secret);
  });
});
