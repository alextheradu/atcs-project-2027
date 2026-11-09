export const instant = false;

import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { adminTabsFor } from "@/lib/nav";

/** /admin opens the first tab this role may use. */
export default async function AdminHome() {
  const user = await requirePageUser();
  const first = adminTabsFor(user.role)[0];
  if (!first) notFound();
  redirect(first.href);
}
