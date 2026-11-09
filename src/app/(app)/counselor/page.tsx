export const instant = false;

import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page";

/** The counselor dashboard is part of Students now. */
export default async function Counselor() {
  await requirePageRole("COUNSELOR", "ADMIN");
  redirect("/students");
}
