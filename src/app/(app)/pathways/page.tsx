export const instant = false;

import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";

/** Pathways is a view inside Classes now. */
export default async function Pathways() {
  await requirePageUser();
  redirect("/courses?view=pathways");
}
