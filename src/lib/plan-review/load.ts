import { db } from "@/lib/db";
import type { CommentView } from "@/components/plan-review/review-panel";

/** Comments on a plan, oldest first. Callers decide who may see the plan before asking for this. */
export async function loadComments(planId: string): Promise<CommentView[]> {
  const rows = await db.planComment.findMany({
    where: { planId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: { name: true, email: true, role: true } }, entry: { select: { course: { select: { name: true } } } } },
  });
  return rows.map((c) => ({
    id: c.id,
    author: c.author ? (c.author.name ?? c.author.email.split("@")[0]) : "Deleted user",
    authorRole: c.author?.role ?? "DELETED",
    body: c.body,
    when: c.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    entryName: c.entry?.course.name ?? null,
  }));
}
