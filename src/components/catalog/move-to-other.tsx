"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setCourseDepartment } from "@/lib/catalog/admin";

/** One-click move into Other Programs for a course that fits no subject. Undo by picking a department in the edit form. */
export function MoveToOther({ courseId, courseName }: { courseId: string; courseName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error && <span role="status" className="text-[13px] text-red">{error}</span>}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Move ${courseName} to Other Programs`}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return;
          setError(null);
          start(async () => {
            const r = await setCourseDepartment(courseId, "OTHER");
            if (r.ok) router.refresh();
            else setError(r.error);
          });
        }}
      >
        {pending ? "Moving" : "Move to Other"}
      </Button>
    </span>
  );
}
