export const instant = false;

import Link from "next/link";
import { RequestRow } from "@/components/catalog/request-row";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function ImportRequests() {
  await requirePageRole("COUNSELOR", "ADMIN");
  const [pending, courses] = await Promise.all([
    db.importRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { id: true, title: true, normalizedTitle: true, courseId: true } }),
    db.course.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // Same title from several students shows once, with a count.
  const groups = new Map<string, { first: (typeof pending)[number]; count: number }>();
  for (const p of pending) {
    const g = groups.get(p.normalizedTitle);
    if (g) g.count++;
    else groups.set(p.normalizedTitle, { first: p, count: 1 });
  }
  return (
    <div className="max-w-[900px]">
      <PageHeader
        title="Import requests"
        description="Course titles students could not match on their transcript. Approving one teaches the importer for everyone."
        back={{ href: "/admin/catalog", label: "Catalog" }}
        actions={<Link className="btn btn-sm" href="/admin/catalog/new">New course</Link>}
      />
      {groups.size === 0 ? (
        <p className="text-sm text-muted">Nothing waiting.</p>
      ) : (
        <ul className="list">
          {[...groups.values()].map(({ first, count }) => (
            <RequestRow key={first.id} id={first.id} title={first.title} count={count} suggestedId={first.courseId} courses={courses} />
          ))}
        </ul>
      )}
    </div>
  );
}
