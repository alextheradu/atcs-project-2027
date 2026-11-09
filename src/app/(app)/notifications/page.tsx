export const instant = false;

import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { homeFor } from "@/lib/nav";

/** Notifications now show as notes on the Board (students) or under Needs a look (staff). Old links land there. */
export default async function Notifications() {
  const user = await requirePageUser();
  redirect(homeFor(user.role));
}
