export const instant = false;

import { PathwayGraph } from "@/components/pathways/pathway-graph";
import { PageHeader } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { canUseStudentWorkspace } from "@/lib/auth/student-access";
import { loadPathways } from "@/lib/pathways/load";

export default async function Pathways() {
  const user = await requirePageUser();
  const { nodes, edges, hasPlan } = await loadPathways(user.id, canUseStudentWorkspace(user.role));
  return (
    <div>
      <PageHeader
        title="Pathways"
        description="The usual course sequences in the Program of Studies. Solid lines are the normal next step. Dashed lines move up a level."
      />
      <PathwayGraph nodes={nodes} edges={edges} hasPlan={hasPlan} />
    </div>
  );
}
