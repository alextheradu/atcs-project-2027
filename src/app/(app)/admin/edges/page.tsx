export const instant = false;

import { EdgeEditor, type EdgeRow } from "@/components/rules/edge-editor";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";
import type { Track } from "@/lib/pathways";
import { canEditDepartment, canEditEdge } from "@/lib/rules/scope";

export default async function EdgesAdmin() {
  const user = await requirePageRole("ADMIN", "SUPERVISOR");

  const [edges, courses] = await Promise.all([
    db.courseEdge.findMany({ include: { from: { select: { name: true, department: true } }, to: { select: { name: true, department: true } } }, orderBy: [{ track: "asc" }, { id: "asc" }] }),
    db.course.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, department: true } }),
  ]);

  // Supervisors see and edit only steps whose two courses are in their departments.
  const rows: EdgeRow[] = edges
    .filter((e) => canEditEdge(user, e.from.department, e.to.department))
    .map((e) => ({ id: e.id, fromId: e.fromId, toId: e.toId, fromName: e.from.name, toName: e.to.name, track: e.track as Track, kind: e.kind, appealable: e.appealable, note: e.note }));
  const options = courses.filter((c) => canEditDepartment(user, c.department)).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title="Pathway steps"
        description="The lines on the pathway graph. A next step is the normal sequence. Moving up a level can need an appeal."
        back={{ href: "/admin/rules", label: "Rules" }}
      />
      <EdgeEditor edges={rows} options={options} />
    </div>
  );
}
