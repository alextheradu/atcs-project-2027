export const instant = false;

import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page";

/** The placement review queue is part of Students now. */
export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePageRole("SUPERVISOR", "ADMIN");
  const { show } = await searchParams;
  redirect(show === "done" ? "/students?tab=look&show=done" : "/students");
}
