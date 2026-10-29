export const instant = false;

import { GuidanceForm } from "@/components/admin/guidance-form";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { loadGuidance } from "@/lib/guidance/load";

export default async function MajorGuidance() {
  await requirePageRole("ADMIN");
  return (
    <div className="max-w-[860px]">
      <PageHeader title="College guidance" description="Years of each subject shown on every plan, from the Program of Studies table on college admission. A student who types an intended major in a group below sees the higher number." />
      <GuidanceForm initial={await loadGuidance()} />
    </div>
  );
}
