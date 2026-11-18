"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { TEACHER_ASSISTANT_LENGTHS, type TeacherAssistantCredits } from "@/lib/catalog/teacher-assistant";
import { addEntry } from "@/lib/plans/actions";

/** Puts a class on the student's Board in the grade they pick. The server checks the plan belongs to them. */
export function AddToBoardButton({ planId, courseId, grades, suggested, teacherAssistant }: { planId: string; courseId: string; grades: number[]; suggested: number; teacherAssistant: boolean }) {
  const router = useRouter();
  const [grade, setGrade] = useState(grades.includes(suggested) ? suggested : grades[0]);
  const [credits, setCredits, creditsDraft] = useDraftState<TeacherAssistantCredits>(`plan:${planId}:course:${courseId}:credits`, 5);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p role="status" className="text-[15px]">
        Added to {done}th grade. <Link href="/board" className="font-medium text-accent-ink hover:underline">Open my board</Link>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const r = await addEntry({ planId, courseId, gradeLevel: grade, credits: teacherAssistant ? credits : undefined });
              if (r.ok) {
                if (teacherAssistant) creditsDraft.commit(credits, 5);
                setDone(grade);
                router.refresh();
              }
              else setError(r.error);
            } catch { setError(SAVE_INTERRUPTED); }
          })
        }
      >
        Add to my board
      </Button>
      {grades.length > 1 && (
        <select className="input !h-[38px] !w-auto" aria-label="Grade to add it to" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
          {grades.map((g) => <option key={g} value={g}>{g}th grade</option>)}
        </select>
      )}
      {teacherAssistant && (
        <select className="input !h-[38px] !w-auto" aria-label="Program length" value={credits} onChange={(e) => setCredits(Number(e.target.value) as TeacherAssistantCredits)}>
          {TEACHER_ASSISTANT_LENGTHS.map(({ credits, label }) => <option key={credits} value={credits}>{label} ({credits} credits)</option>)}
        </select>
      )}
      {error && <p role="alert" className="w-full text-[14px] text-red">{error}</p>}
    </div>
  );
}
