"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addAlias, removeAlias } from "@/lib/catalog/admin";

export function AliasManager({ courseId, aliases }: { courseId: string; aliases: { id: string; alias: string }[] }) {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="space-y-4 border-t border-line pt-6">
      <div>
        <h2 className="text-sm font-medium">Transcript aliases</h2>
        <p className="mt-1 text-[13px] text-muted">Other titles that should match this course when a transcript is imported. Stored in a normalized form.</p>
      </div>
      <ul className="list">
        {aliases.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
            <span className="num text-[13px]">{a.alias}</span>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { await removeAlias(a.id); router.refresh(); })}>Remove</Button>
          </li>
        ))}
        {aliases.length === 0 && <li className="py-4 text-[13px] text-muted">No aliases yet.</li>}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addAlias({ courseId, alias });
            setMsg(r.ok ? null : r.error);
            if (r.ok) { setAlias(""); router.refresh(); }
          });
        }}
      >
        <input className="input !w-72" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Hon Eng I" aria-label="Alias" required />
        <Button type="submit" disabled={pending}>Add alias</Button>
        {msg && <span role="status" className="text-sm text-red">{msg}</span>}
      </form>
    </section>
  );
}
