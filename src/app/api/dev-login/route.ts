import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isDevAuthEnabled } from "@/lib/auth/dev-login";
import { normalizeEmail, type Department, type Role } from "@/lib/auth/policy";

const ROLES: Role[] = ["STUDENT", "INCOMING", "COUNSELOR", "SUPERVISOR", "ADMIN"];

/** GET /api/dev-login?email=a@pascack.org&role=COUNSELOR&dept=MATH,SCIENCE */
export async function GET(req: NextRequest) {
  if (!isDevAuthEnabled(process.env)) return new NextResponse(null, { status: 404 });

  const q = req.nextUrl.searchParams;
  const email = normalizeEmail(q.get("email") ?? "");
  const role = (q.get("role") ?? "STUDENT") as Role;
  if (!email.includes("@") || !ROLES.includes(role)) {
    return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
  }
  const departments = (q.get("dept") ?? "").split(",").filter(Boolean) as Department[];

  const user = await db.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], emailVerified: new Date(), role, departments },
    update: { role, departments },
  });
  const sessionToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 7 * 24 * 3600_000) },
  });

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("authjs.session-token", sessionToken, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
