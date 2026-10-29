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
  // Skip onboarding by default so other checks stay quick. Pass onboarding=1 to walk it.
  if (q.get("onboarding") === "1") {
    await db.user.update({ where: { id: user.id }, data: { onboardedAt: null, ageConfirmed13At: null } });
    await db.policyAcceptance.deleteMany({ where: { userId: user.id } });
    await db.onboardingProgress.deleteMany({ where: { userId: user.id } });
    await db.studentProfile.deleteMany({ where: { userId: user.id } });
  } else {
    await db.user.update({ where: { id: user.id }, data: { onboardedAt: user.onboardedAt ?? new Date(), ageConfirmed13At: user.ageConfirmed13At ?? new Date() } });
    const docs = await db.policyDocument.findMany({ orderBy: { version: "desc" } });
    const latest = [...new Map(docs.map((d) => [d.kind, d])).values()];
    await db.policyAcceptance.createMany({ data: latest.map((d) => ({ userId: user.id, documentId: d.id })), skipDuplicates: true });
  }
  const sessionToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 7 * 24 * 3600_000) },
  });

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("authjs.session-token", sessionToken, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
