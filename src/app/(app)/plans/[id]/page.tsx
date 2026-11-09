export const instant = false;

import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page";

/** Old plan links (bookmarks, emails) land on the Board, which shows the student's one plan. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  await requirePageUser();
  const { tour } = await searchParams;
  redirect(tour === "1" ? "/board?tour=1" : "/board");
}
