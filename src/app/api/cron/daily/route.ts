import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import { expireSnapshots, processDueDeletions, sendTimelineReminders } from "@/lib/notify/daily";

/** Called once a day by a scheduler. */
export async function POST(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    snapshotsExpired: await expireSnapshots(),
    deletionsProcessed: await processDueDeletions(),
    remindersQueued: await sendTimelineReminders(),
  });
}
