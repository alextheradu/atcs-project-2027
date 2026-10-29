"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { DraftNotice, SAVE_INTERRUPTED, useDraftState } from "@/components/draft-state";
import { Button } from "@/components/ui/button";
import { TRACKS, TRACK_LABEL, type Track } from "@/lib/pathways";
import { createEdge, deleteEdge, updateEdge } from "@/lib/rules/actions";

export interface EdgeRow {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  track: Track;
  kind: "STANDARD" | "ADVANCE";
  appealable: boolean;
  note: string | null;
}

interface Option {
  id: string;
  name: string;
}

export function EdgeEditor({ edges, options }: { edges: EdgeRow[]; options: Option[] }) {
  const listId = useId();
  const [track, setTrack, trackDraft] = useDraftState<Track>("edge:track", "MATH");
  const [from, setFrom, fromDraft] = useDraftState("edge:from", "");
  const [to, setTo, toDraft] = useDraftState("edge:to", "");
  const [kind, setKind, kindDraft] = useDraftState<"STANDARD" | "ADVANCE">("edge:kind", "STANDARD");
  const [note, setNote, noteDraft] = useDraftState("edge:note", "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byName = useMemo(() => new Map(options.map((o) => [o.name.toLowerCase(), o.id])), [options]);
  const shown = edges.filter((e) => e.track === track);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) setError(r.error ?? "That did not work.");
        else after?.();
      } catch { setError(SAVE_INTERRUPTED); }
    });
  }

  function add() {
    const fromId = byName.get(from.trim().toLowerCase());
    const toId = byName.get(to.trim().toLowerCase());
    if (!fromId || !toId) return setError("Pick both courses from the list.");
    run(
      () => createEdge({ fromId, toId, track, kind, appealable: true, note: note || null }),
      () => {
        fromDraft.commit(from, "");
        toDraft.commit(to, "");
        noteDraft.commit(note, "");
        trackDraft.commit(track); kindDraft.commit(kind);
      },
    );
  }

  return (
    <div className="space-y-8">
      <DraftNotice drafts={[fromDraft, toDraft, noteDraft, kindDraft]} />
      <div role="tablist" aria-label="Pathway" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line">
        {TRACKS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === track}
            onClick={() => setTrack(t)}
            className={`-mb-px border-b py-2 text-[13px] transition-colors ${t === track ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {TRACK_LABEL[t]}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-[13px] text-red">{error}</p>}

      <ul className="list">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{e.fromName}</span>
              <span className="text-muted"> → </span>
              <span className="font-medium">{e.toName}</span>
              {e.note && <span className="mt-0.5 block truncate text-xs text-muted">{e.note}</span>}
            </span>
            <select
              className="input !h-8 !w-auto"
              aria-label={`Kind of step from ${e.fromName} to ${e.toName}`}
              value={e.kind}
              disabled={pending}
              onChange={(ev) => run(() => updateEdge(e.id, { kind: ev.target.value, appealable: e.appealable, track: e.track, note: e.note }))}
            >
              <option value="STANDARD">Next step</option>
              <option value="ADVANCE">Moves up a level</option>
            </select>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteEdge(e.id))}>Delete</Button>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-[13px] text-muted">No steps in this pathway yet.</li>}
      </ul>

      <section aria-label="Add a step" className="space-y-3 border-t border-line pt-6">
        <h2 className="text-sm font-medium">Add a step to {TRACK_LABEL[track]}</h2>
        <datalist id={listId}>{options.map((o) => <option key={o.id} value={o.name} />)}</datalist>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" list={listId} aria-label="From course" placeholder="From course" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" list={listId} aria-label="To course" placeholder="To course" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="input" aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="STANDARD">Next step</option>
            <option value="ADVANCE">Moves up a level</option>
          </select>
          <input className="input" aria-label="Note" placeholder="Note (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button variant="primary" disabled={pending} onClick={add}>Add step</Button>
      </section>
    </div>
  );
}
