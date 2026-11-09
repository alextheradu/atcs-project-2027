import { describe, expect, it } from "vitest";
import { canUseStudentWorkspace } from "./student-access";
import { adminTabsFor, menuFor, navFor } from "@/lib/nav";

describe("student workspace access", () => {
  it.each(["STUDENT", "INCOMING", "ADMIN"] as const)("allows %s", (role) => {
    expect(canUseStudentWorkspace(role)).toBe(true);
  });

  it.each(["COUNSELOR", "SUPERVISOR"] as const)("keeps %s access unchanged", (role) => {
    expect(canUseStudentWorkspace(role)).toBe(false);
  });

  it("gives admins every student navigation destination alongside admin tools", () => {
    const admin = navFor("ADMIN").map((item) => item.href);
    const adminMenu = menuFor("ADMIN").map((item) => item.href);
    for (const role of ["STUDENT", "INCOMING"] as const) {
      for (const item of navFor(role)) expect(admin).toContain(item.href);
      for (const item of menuFor(role)) expect(adminMenu).toContain(item.href);
    }
    expect(admin).toContain("/admin");
    expect(adminTabsFor("ADMIN").map((t) => t.href)).toContain("/admin/users");
  });
});
