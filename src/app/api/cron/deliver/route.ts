import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import { claimDue, processDelivery } from "@/lib/notify/deliver";

/** Called every minute by a scheduler. Sends due email and push deliveries. */
export async function POST(req: NextRequest) {
  if (!cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ids = await claimDue();
  const totals = { claimed: ids.length, sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const id of ids) {
    const o = await processDelivery(id);
    if (!o) continue;
    if (o.status === "SENT") totals.sent++;
    else if (o.status === "PENDING") totals.retry++;
    else if (o.status === "FAILED") totals.failed++;
    else totals.skipped++;
  }
  return NextResponse.json(totals);
}
