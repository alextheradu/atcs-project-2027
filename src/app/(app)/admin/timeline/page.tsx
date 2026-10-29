export const instant = false;

import { TimelineEditor } from "@/components/appeals/timeline-editor";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function Timeline() {
  await requirePageRole("ADMIN");
  const rows = await db.timelineEvent.findMany({ orderBy: [{ opensAt: "desc" }] });
  return (
    <div className="max-w-[760px]">
      <PageHeader title="Dates" description="Course selection and appeal windows. Incoming 8th graders can only submit a placement review inside an open appeal window. Nothing here is built in: set each year's dates yourself." />
      <TimelineEditor rows={rows.map((r) => ({ id: r.id, kind: r.kind, audience: r.audience, label: r.label, schoolYear: r.schoolYear, opensAt: r.opensAt.toISOString(), closesAt: r.closesAt?.toISOString() ?? null }))} />
    </div>
  );
}
