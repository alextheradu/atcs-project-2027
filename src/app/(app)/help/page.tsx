export const instant = false;

import { PageHeader } from "@/components/ui/page";
import { requirePageUser } from "@/lib/auth/page";
import { LEARN_CARDS } from "@/lib/learn/content";

export default async function Help() {
  await requirePageUser();
  return (
    <div className="max-w-[680px]">
      <PageHeader title="Help" description="The basics, in five short parts." />
      <div className="space-y-10">
        {LEARN_CARDS.map((c) => (
          <section key={c.id} id={c.id} aria-labelledby={`${c.id}-h`}>
            <h2 id={`${c.id}-h`} className="text-base font-medium">{c.title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
              {c.body.map((p) => <p key={p} className="max-w-[65ch]">{p}</p>)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
