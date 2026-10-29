"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { createDraftStore, draftKey, type DraftSnapshot } from "@/lib/drafts/store";

const DraftUser = createContext<string | null>(null);

export function DraftProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return <DraftUser.Provider key={userId} value={userId}>{children}</DraftUser.Provider>;
}

export function useDraftState<T>(resource: string, initial: T) {
  const userId = useContext(DraftUser);
  if (!userId) throw new Error("An editor needs a signed-in draft scope.");
  // A refresh of server props must not replace a draft or recreate its store.
  // Resource changes create a separate store, including during client navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => createDraftStore(() => window.sessionStorage, draftKey(userId, resource), initial), [userId, resource]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    if (!state.dirty || !state.unavailable) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty, state.unavailable]);
  return [state.value, store.set, { ...state, commit: store.commit, discard: store.discard }] as const;
}

export function DraftNotice({ drafts }: { drafts: DraftSnapshot<unknown>[] }) {
  const dirty = drafts.some((draft) => draft.dirty);
  if (!dirty) return null;
  const unavailable = drafts.some((draft) => draft.unavailable);
  const conflict = drafts.some((draft) => draft.conflict);
  const recovered = drafts.some((draft) => draft.recovered);
  return (
    <p role="status" className={`text-[13px] ${unavailable || conflict ? "text-yellow" : "text-muted"}`}>
      {unavailable ? "This browser cannot keep a recovery draft. Keep this page open until you save."
        : conflict ? "Your unsaved draft was recovered. Saved data has also changed. Review your draft before saving."
        : recovered ? "Your unsaved draft was recovered in this tab. Review it and save when ready."
        : "Unsaved changes are kept in this tab if the page reloads."}
    </p>
  );
}

export const SAVE_INTERRUPTED = "Saving was interrupted. Your changes are still here. Reload this page if the site was updated, then try saving again.";
