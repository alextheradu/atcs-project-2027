import { describe, expect, it } from "vitest";
import { MAX_PHONE_TABS, navFor, phoneTabs } from "@/lib/nav";

const hrefs = (role: Parameters<typeof navFor>[0]) => phoneTabs(navFor(role)).map((i) => i.href);

describe("phoneTabs", () => {
  it("never shows more than the phone bar can fit, for any role", () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"] as const) {
      expect(hrefs(role).length).toBeLessThanOrEqual(MAX_PHONE_TABS);
    }
  });

  it("gives students the planning loop", () => {
    expect(hrefs("STUDENT")).toEqual(["/dashboard", "/plans", "/courses", "/pathways"]);
  });

  it("puts a staff member's work queue right after the dashboard", () => {
    expect(hrefs("COUNSELOR")[1]).toBe("/counselor");
    expect(hrefs("SUPERVISOR")[1]).toBe("/review");
  });

  it("only offers tabs the role can open", () => {
    for (const role of ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"] as const) {
      const allowed = navFor(role).map((i) => i.href);
      for (const href of hrefs(role)) expect(allowed).toContain(href);
    }
  });

  it("keeps the caller's item objects, so counts survive", () => {
    const nav = [{ href: "/review", label: "Reviews", group: "Admin", count: 3 }];
    expect(phoneTabs(nav)[0]).toBe(nav[0]);
  });
});
