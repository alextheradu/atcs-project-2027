/** The five basics. One source for onboarding, /help and the in-app hints. */
export interface LearnCard {
  id: "credits" | "graduation" | "levels" | "pathways" | "appeals";
  title: string;
  /** One sentence for a tooltip. */
  hint: string;
  body: string[];
}

export const LEARN_CARDS: LearnCard[] = [
  {
    id: "credits",
    title: "How credits work",
    hint: "A full-year course is 5 credits, a half-year course is 2.5. You need 120 to graduate.",
    body: [
      "A full-year course is worth 5 credits. A half-year course is worth 2.5. A few double period courses are worth 10.",
      "You need 120 credits to graduate. Most students take about 30 credits a year.",
    ],
  },
  {
    id: "graduation",
    title: "What graduation needs",
    hint: "120 credits, with minimums in English, math, science, social studies, world language, arts, health and more.",
    body: [
      "Besides 120 total credits, each subject has a minimum: English, math, science, social studies, world language, the arts, financial literacy, health and physical education, and 21st century life and careers.",
      "The planner shows each one as a bar so you can see what is still missing.",
    ],
  },
  {
    id: "levels",
    title: "Course levels",
    hint: "College prep, Enhanced, Honors and AP move faster and go deeper in that order. Some courses offer dual enrollment.",
    body: [
      "College prep (CP) is the standard pace. Enhanced goes deeper and faster. Honors goes further. AP follows a college course and ends with an exam in May.",
      "Some courses offer dual enrollment, which lets you earn college credit at your own cost.",
    ],
  },
  {
    id: "pathways",
    title: "Pathways: locked and appealable",
    hint: "Locked means a step was skipped. Appealable means you are close and can ask for a placement review.",
    body: [
      "Many courses need an earlier course first. If you skipped a step, the course is locked.",
      "If you took the right course but the grade is a little short, or you want to move up a level, you can appeal. A supervisor makes the decision.",
    ],
  },
  {
    id: "appeals",
    title: "Appeals",
    hint: "An appeal asks a supervisor to place you in a course you do not automatically qualify for. It opens during a set window each year.",
    body: [
      "An appeal asks a department supervisor to place you in a course you do not automatically qualify for. You explain why, and they decide.",
      "Appeals open during a window each year. We will tell you when it opens.",
    ],
  },
];

export const HINTS: Record<LearnCard["id"], string> = Object.fromEntries(LEARN_CARDS.map((c) => [c.id, c.hint])) as Record<LearnCard["id"], string>;
