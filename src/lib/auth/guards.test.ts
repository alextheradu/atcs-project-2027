import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthenticatedError, assertRole, canDemoteAdmin, ownsResource, type SessionUser } from "./guards";

const u = (role: SessionUser["role"], id = "u1"): SessionUser => ({
  id,
  role,
  departments: [],
  email: "x@pascack.org",
  name: null,
});

describe("assertRole", () => {
  it("throws Unauthenticated for no user", () => {
    expect(() => assertRole(null, ["ADMIN"])).toThrow(UnauthenticatedError);
  });
  it("throws Forbidden for a wrong role", () => {
    expect(() => assertRole(u("STUDENT"), ["ADMIN"])).toThrow(ForbiddenError);
    expect(() => assertRole(u("COUNSELOR"), ["ADMIN"])).toThrow(ForbiddenError);
    expect(() => assertRole(u("INCOMING"), ["ADMIN", "COUNSELOR"])).toThrow(ForbiddenError);
  });
  it("returns the user for an allowed role", () => {
    const admin = u("ADMIN");
    expect(assertRole(admin, ["ADMIN"])).toBe(admin);
    expect(assertRole(u("COUNSELOR"), ["ADMIN", "COUNSELOR"]).role).toBe("COUNSELOR");
  });
});

describe("ownsResource", () => {
  it("is true only for the owner", () => {
    expect(ownsResource(u("STUDENT", "a"), "a")).toBe(true);
    expect(ownsResource(u("STUDENT", "a"), "b")).toBe(false);
  });
  it("is false when ownerId is missing", () => {
    expect(ownsResource(u("ADMIN", "a"), null)).toBe(false);
  });
});

describe("canDemoteAdmin", () => {
  it("blocks removing the last admin", () => {
    expect(canDemoteAdmin({ adminCount: 1, targetIsAdmin: true, newRole: "STUDENT" })).toBe(false);
  });
  it("allows when other admins remain", () => {
    expect(canDemoteAdmin({ adminCount: 2, targetIsAdmin: true, newRole: "COUNSELOR" })).toBe(true);
  });
  it("allows keeping admin even when alone", () => {
    expect(canDemoteAdmin({ adminCount: 1, targetIsAdmin: true, newRole: "ADMIN" })).toBe(true);
  });
  it("is irrelevant when the target is not an admin", () => {
    expect(canDemoteAdmin({ adminCount: 1, targetIsAdmin: false, newRole: "STUDENT" })).toBe(true);
  });
});
