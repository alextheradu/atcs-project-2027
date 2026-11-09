import { describe, expect, it } from "vitest";
import { ADMIN_TABS, CATALOG_SUBTABS, MENU, adminTabsFor, homeFor, menuFor, navFor } from "@/lib/nav";

const ROLES = ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"] as const;
const labels = (role: (typeof ROLES)[number]) => navFor(role).map((i) => i.label);

describe("navFor", () => {
  it("gives students two places", () => {
    expect(labels("STUDENT")).toEqual(["Board", "Classes"]);
    expect(labels("INCOMING")).toEqual(["Board", "Classes"]);
  });
  it("gives counselors and supervisors their work, not a Board", () => {
    expect(labels("COUNSELOR")).toEqual(["Classes", "Students", "Admin"]);
    expect(labels("SUPERVISOR")).toEqual(["Classes", "Students", "Admin"]);
  });
  it("gives admins everything, including a Board to test the student view", () => {
    expect(labels("ADMIN")).toEqual(["Board", "Classes", "Students", "Admin"]);
  });
  it("never shows more than four items", () => {
    for (const role of ROLES) expect(navFor(role).length).toBeLessThanOrEqual(4);
  });
});

describe("adminTabsFor", () => {
  it("shows a counselor only the catalog", () => {
    expect(adminTabsFor("COUNSELOR").map((t) => t.href)).toEqual(["/admin/catalog"]);
  });
  it("shows a supervisor rules, appeal questions and prerequisite links", () => {
    expect(adminTabsFor("SUPERVISOR").map((t) => t.href)).toEqual(["/admin/rules", "/admin/appeal-questions", "/admin/edges"]);
  });
  it("shows an admin every tab, with prerequisite links inside the catalog", () => {
    expect(adminTabsFor("ADMIN").map((t) => t.href)).toEqual([
      "/admin/catalog", "/admin/rules", "/admin/appeal-questions", "/admin/timeline", "/admin/major-guidance",
      "/admin/users", "/admin/deletions", "/admin/settings",
    ]);
  });
  it("shows students nothing", () => {
    expect(adminTabsFor("STUDENT")).toEqual([]);
    expect(adminTabsFor("INCOMING")).toEqual([]);
  });
  it("only lists tabs the role can open", () => {
    for (const role of ROLES) {
      for (const t of adminTabsFor(role)) {
        const def = [...ADMIN_TABS, ...CATALOG_SUBTABS].find((x) => x.href === t.href)!;
        expect(def.roles, `${role} ${t.href}`).toContain(role);
      }
    }
  });
});

describe("menuFor", () => {
  it("offers transcript import only to roles with their own plan", () => {
    expect(menuFor("STUDENT").map((m) => m.href)).toContain("/import");
    expect(menuFor("ADMIN").map((m) => m.href)).toContain("/import");
    expect(menuFor("COUNSELOR").map((m) => m.href)).not.toContain("/import");
    expect(menuFor("SUPERVISOR").map((m) => m.href)).not.toContain("/import");
  });
  it("lets anyone with their own plan find their placement reviews", () => {
    expect(menuFor("STUDENT").map((m) => m.href)).toContain("/appeals");
    expect(menuFor("INCOMING").map((m) => m.href)).toContain("/appeals");
    expect(menuFor("COUNSELOR").map((m) => m.href)).not.toContain("/appeals");
  });
  it("always has settings and help", () => {
    for (const role of ROLES) expect(menuFor(role).map((m) => m.href)).toEqual(expect.arrayContaining(["/settings", "/help"]));
  });
  it("is built from MENU", () => {
    expect(MENU.length).toBeGreaterThanOrEqual(3);
  });
});

describe("homeFor", () => {
  it("sends students and admins to the Board, other staff to Students", () => {
    expect(homeFor("STUDENT")).toBe("/board");
    expect(homeFor("INCOMING")).toBe("/board");
    expect(homeFor("ADMIN")).toBe("/board");
    expect(homeFor("COUNSELOR")).toBe("/students");
    expect(homeFor("SUPERVISOR")).toBe("/students");
  });
});
