import { z } from "zod";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface DraftSnapshot<T> {
  value: T;
  dirty: boolean;
  recovered: boolean;
  conflict: boolean;
  unavailable: boolean;
}

const envelope = z.object({ version: z.literal(1), base: z.json(), value: z.json() });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Reject incompatible field types after an editor's shape changes. Server actions
// still validate every submission with their domain schemas and authorization.
function compatible(value: unknown, initial: unknown): boolean {
  if (initial === null) return true;
  if (Array.isArray(initial)) return Array.isArray(value) && value.every((v) => !initial.length || compatible(v, initial[0]));
  if (typeof initial === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      && Object.entries(initial).every(([k, v]) => compatible((value as Record<string, unknown>)[k], v));
  }
  return typeof value === typeof initial;
}

export const draftKey = (userId: string, resource: string) => `pascack:draft:v1:${encodeURIComponent(userId)}:${resource}`;

/** Tab-local recovery, independent of releases. Never writes to the server. */
export function createDraftStore<T>(storage: StorageAccess, key: string, initial: T) {
  let base = initial;
  const server: DraftSnapshot<T> = { value: initial, dirty: false, recovered: false, conflict: false, unavailable: false };
  let snapshot = server;
  let loaded = false;
  const listeners = new Set<() => void>();
  function read() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = storage().getItem(key);
      if (!raw) return;
      const parsed = envelope.safeParse(JSON.parse(raw));
      if (!parsed.success || !compatible(parsed.data.value, initial)) return;
      if (equal(parsed.data.value, initial)) {
        storage().removeItem(key);
        return;
      }
      snapshot = { ...server, value: parsed.data.value as T, dirty: true, recovered: true, conflict: !equal(parsed.data.base, initial) };
    } catch {
      snapshot = { ...snapshot, unavailable: true };
    }
  }
  function publish(value: T) {
    snapshot = { ...snapshot, value, dirty: !equal(value, base) };
    try {
      if (snapshot.dirty) storage().setItem(key, JSON.stringify({ version: 1, base, value }));
      else storage().removeItem(key);
      snapshot = { ...snapshot, unavailable: false };
    } catch {
      snapshot = { ...snapshot, unavailable: true };
    }
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => { read(); return snapshot; },
    getServerSnapshot: () => server,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: (next: T | ((previous: T) => T)) => {
      read();
      publish(typeof next === "function" ? (next as (previous: T) => T)(snapshot.value) : next);
    },
    commit: (submitted: T) => {
      read();
      base = submitted;
      snapshot = { ...snapshot, recovered: false, conflict: false };
      publish(snapshot.value);
    },
    discard: () => {
      read();
      snapshot = { ...snapshot, recovered: false, conflict: false };
      publish(base);
    },
  };
}
