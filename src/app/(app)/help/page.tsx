export const instant = false;

import { PageHeader } from "@/components/ui/page";
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
    <div className="max-w-[680px]">
      <PageHeader title="Help" description="How the planner works, then the basics of credits and placement." />
      <section aria-labelledby="using-h" className="soft mb-10 space-y-4 p-5">
        <h2 id="using-h" className="eyebrow">Using the planner</h2>
        {USING.map(([title, text]) => (
          <div key={title}>
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <p className="mt-0.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>
      <div className="space-y-8">
        {LEARN_CARDS.map((c) => (
          <section key={c.id} id={c.id} aria-labelledby={`${c.id}-h`}>
            <h2 id={`${c.id}-h`} className="eyebrow">{c.title}</h2>
            <div className="mt-1.5 space-y-2 text-[15px] leading-relaxed text-muted">
              {c.body.map((p) => <p key={p} className="max-w-[65ch]">{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
