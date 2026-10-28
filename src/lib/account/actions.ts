"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signIn, signOut, requireUser } from "@/lib/auth";
import { LINK_INTENT_COOKIE, LINK_INTENT_TTL_MS, signLinkIntent } from "@/lib/auth/link-intent";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** Step 1 of linking a second email: remember the intent, then send the user to Google's account chooser. */
export async function startLinkEmail() {
  const user = await requireUser();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  (await cookies()).set(LINK_INTENT_COOKIE, signLinkIntent(user.id, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LINK_INTENT_TTL_MS / 1000,
  });
  await signIn("google", { redirectTo: "/settings?link=ok" }, { prompt: "select_account" });
}

export async function removeLinkedEmail(linkedEmailId: string) {
  const user = await requireUser();
  if (typeof linkedEmailId !== "string" || !linkedEmailId || linkedEmailId.length > 64) return;
  // Ownership check in the query itself.
  const row = await db.linkedEmail.findFirst({ where: { id: linkedEmailId, userId: user.id } });
  if (!row) return;
  await db.$transaction(async (tx) => {
    await tx.linkedEmail.delete({ where: { id: row.id } });
    await writeAudit({ actor: user, action: "user.email_unlinked", entityType: "User", entityId: user.id }, tx);
  });
  revalidatePath("/settings");
}
