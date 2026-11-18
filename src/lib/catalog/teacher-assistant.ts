// The 2026-2027 Program of Studies, page 56, lists both lengths for this course.
export const TEACHER_ASSISTANT_SLUG = "teacher-assistant-program";
export const TEACHER_ASSISTANT_LENGTHS = [
  { duration: "HALF", label: "Half year", credits: 2.5 },
  { duration: "FULL", label: "Full year", credits: 5 },
] as const;

export type TeacherAssistantCredits = (typeof TEACHER_ASSISTANT_LENGTHS)[number]["credits"];
export const TEACHER_ASSISTANT_CREDITS = TEACHER_ASSISTANT_LENGTHS.map(({ credits }) => credits).join(" or ");
