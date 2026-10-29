// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import Link from "next/link";
import { ConfirmDeletion } from "@/components/settings/confirm-deletion";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { db } from "@/lib/db";
import { GRACE_DAYS, verifyConfirm } from "@/lib/deletion";

export const metadata = { title: "confirm deletion" };

export default async function ConfirmDelete({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const user = await requirePageUser();
  const { token = "" } = await searchParams;
  const v = process.env.AUTH_SECRET ? verifyConfirm(token, process.env.AUTH_SECRET) : null;
  // The request must belong to the signed-in person. Confirming refreshes this page, so a request that
  // just became scheduled has to read as done, not as an invalid link.
  const req = v && v.userId === user.id ? await db.deletionRequest.findFirst({ where: { id: v.requestId, userId: user.id, status: { in: ["AWAITING_CONFIRMATION", "SCHEDULED"] } }, select: { status: true, scheduledFor: true } }) : null;

  return (
    <div className="max-w-[560px]">
      <PageHeader title="Confirm deletion" back={{ href: "/settings", label: "Settings" }} />
      {req?.status === "SCHEDULED" ? (
        <div className="space-y-3">
          <p role="status" className="text-sm">Deletion is scheduled for <span className="num">{req.scheduledFor?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>. You can cancel any time before then.</p>
          <Link href="/settings" className={buttonVariants({ size: "sm" })}>Back to settings</Link>
        </div>
      ) : req ? (
        <div className="space-y-4">
          <p className="max-w-[65ch] text-sm text-muted">
            This deletes your account, plans, placement reviews, linked emails and push devices {GRACE_DAYS} days after you confirm. Until then you can cancel in Settings and nothing changes. Download your data first if you want a copy.
          </p>
          <ConfirmDeletion token={token} days={GRACE_DAYS} />
        </div>
      ) : (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-muted">This link is not valid, has expired, or was already used. It only works for the account that asked, while signed in.</p>
          <Link href="/settings" className="text-[13px] text-accent underline-offset-4 hover:underline">Back to settings</Link>
        </div>
      )}
    </div>
  );
}
