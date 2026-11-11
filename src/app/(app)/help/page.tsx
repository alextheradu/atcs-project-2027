export const instant = false;

import { PageHeader, Section } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { LEARN_CARDS } from "@/lib/learn/content";

const USING = [
  ["Board", "Your plan for all four years. Each row is a subject, each column a grade. Outlined spots are what you still need to graduate: click one to see the classes that fill it. Click a class to move it to another grade, mark it done, or remove it."],
  ["Classes", "Every class in the Program of Studies. Each class page tells you first whether you can take it, and why not if you can't. Switch to Pathways to see the order of classes in each subject and how moving up or down a level works."],
  ["The menu under your name", "Import a transcript, change settings and notifications, and read this page."],
] as const;

export default async function Help() {
  await requirePageUser();
  return (
    <div>
      <PageHeader title="Help" description="How the planner works, then the basics of credits and placement." />
      <div className="space-y-14">
        <Section split title="Using the planner" description="Two places hold everything: your Board and the class list.">
          <dl className="max-w-[65ch] space-y-4 text-[15px] leading-relaxed">
            {USING.map(([title, text]) => (
              <div key={title}>
                <dt className="font-semibold">{title}</dt>
                <dd className="mt-0.5 text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </Section>
        {LEARN_CARDS.map((c) => (
          <Section split key={c.id} id={c.id} title={c.title}>
            <div className="max-w-[65ch] space-y-2.5 text-[15px] leading-relaxed text-muted">
              {c.body.map((p) => <p key={p}>{p}</p>)}
            </div>
          </Section>
        ))}
      </div>
    </div>
  );
}
