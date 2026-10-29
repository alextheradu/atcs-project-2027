import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { ForbiddenError, UnauthenticatedError, requireUser } from "@/lib/auth";
import { buildExport } from "@/lib/export";
import { RateLimitError, enforceLimit } from "@/lib/rate-limit";

/** Download my data. Always the signed-in person's own, never a parameter. */
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    throw e;
  }
  try {
    enforceLimit("export", user.id);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429, headers: { "Retry-After": String(Math.ceil(e.retryAfterMs / 1000)) } });
    throw e;
  }
  const data = await buildExport(user.id);
  await writeAudit({ actor: user, action: "user.data_exported", entityType: "User", entityId: user.id });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-course-planner-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
