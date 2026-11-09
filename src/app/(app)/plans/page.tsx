export const instant = false;

import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";

/** Each student has one plan, shown on the Board. */
export default async function Plans() {
  await requirePageUser();
  redirect("/board");
}
