export const instant = false;

import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";
import { homeFor } from "@/lib/nav";

/** The old home page. Students now start on the Board, staff on Students. */
export default async function Dashboard() {
  const user = await requirePageUser();
  redirect(homeFor(user.role));
}
