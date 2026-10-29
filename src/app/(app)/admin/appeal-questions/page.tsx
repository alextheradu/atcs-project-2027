export const instant = false;

import { QuestionEditor } from "@/components/appeals/question-editor";
import { PageHeader } from "@/components/ui/page";
import { requirePageRole } from "@/lib/auth/page";
import { DEPARTMENTS } from "@/lib/admin/schemas";
import { db } from "@/lib/db";

export default async function AppealQuestions() {
  const user = await requirePageRole("ADMIN", "SUPERVISOR");
  const rows = await db.appealQuestion.findMany({ orderBy: [{ sortOrder: "asc" }, { prompt: "asc" }] });
  const admin = user.role === "ADMIN";
  const departments = admin ? [...DEPARTMENTS] : user.departments;
  return (
    <div className="max-w-[760px]">
      <PageHeader title="Appeal questions" description={admin ? "What students answer when they ask for a placement review. Add a question for one department or for all." : "Questions for your departments. Questions for all departments are set by an admin."} />
      <QuestionEditor
        rows={rows.filter((r) => admin || r.department === null || user.departments.includes(r.department)).map((r) => ({ id: r.id, department: r.department, prompt: r.prompt, helpText: r.helpText, type: r.type, options: Array.isArray(r.options) ? (r.options as string[]) : [], required: r.required, sortOrder: r.sortOrder, active: r.active }))}
        departments={departments}
        canAll={admin}
      />
    </div>
  );
}
