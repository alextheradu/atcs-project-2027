import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/** Runs public/sw.js in a stub worker and asks it what it would cache. */
function load() {
  const handlers: Record<string, (e: unknown) => void> = {};
  const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
  const self = {
    location: { origin: "https://app.example.com" },
    addEventListener: (t: string, fn: (e: unknown) => void) => { handlers[t] = fn; },
    skipWaiting: vi.fn(), clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() },
    registration: { showNotification: vi.fn() },
  };
  const fetchMock = vi.fn(async () => ({ ok: true, type: "basic", clone: () => ({}) }));
  vm.runInNewContext(readFileSync(path.resolve("public/sw.js"), "utf8"), { self, caches: { open: async () => cache, keys: async () => [], delete: vi.fn() }, fetch: fetchMock, URL, Promise, String, JSON });
  const request = async (url: string, method = "GET") => {
    let handled = false;
    handlers.fetch({ request: { url: `https://app.example.com${url}`, method }, respondWith: (p: Promise<unknown>) => { handled = true; void p; } });
    await new Promise((r) => setTimeout(r, 0));
    return handled;
  };
  return { handlers, cache, self, request, fetchMock };
}

describe("service worker", () => {
  it("only touches static assets, never pages, API calls or student data", async () => {
    const sw = load();
    for (const url of ["/api/auth/session", "/api/cron/deliver", "/plans/abc", "/dashboard", "/appeals/1", "/import", "/counselor", "/"]) {
      expect(await sw.request(url), url).toBe(false);
    }
    expect(sw.cache.put).not.toHaveBeenCalled();
  });
  it("caches built static files and icons", async () => {
    const sw = load();
    expect(await sw.request("/_next/static/chunks/app.js")).toBe(true);
    expect(await sw.request("/icons/icon-192.png")).toBe(true);
    expect(sw.cache.put).toHaveBeenCalledTimes(2);
  });
  it("ignores non-GET requests, even to static paths, and other origins", async () => {
    const sw = load();
    expect(await sw.request("/_next/static/x.js", "POST")).toBe(false);
  });
  it("shows a short push notification that opens a local link", () => {
    const sw = load();
    sw.handlers.push({ data: { json: () => ({ title: "T", body: "B", url: "https://evil.example/x" }) }, waitUntil: (p: unknown) => p });
    const [title, opts] = sw.self.registration.showNotification.mock.calls[0] as [string, { data: { url: string } }];
    expect(title).toBe("T");
    expect(opts.data.url).toBe("/dashboard");
  });
});
