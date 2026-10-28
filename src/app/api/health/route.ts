import { connection } from "next/server";
import { db } from "@/lib/db";

/** Liveness plus database reachability. Returns no user data. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unreachable" }, { status: 503 });
  }
}
