import { describe, expect, it } from "vitest";
import { createDraftStore, draftKey } from "./store";

function setup() {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  return { data, storage: () => storage };
}

describe("editor recovery", () => {
  it("writes each edit immediately and recovers after a new app load", () => {
    const { storage } = setup();
    const first = createDraftStore(storage, "course", { name: "Original" });
    first.set({ name: "Edited" });
    expect(createDraftStore(storage, "course", { name: "Original" }).getSnapshot()).toMatchObject({ value: { name: "Edited" }, recovered: true, dirty: true });
  });
  it("isolates users and resources, without a build identifier in the key", () => {
    const { storage } = setup();
    const key = draftKey("user-a", "course:one");
    createDraftStore(storage, key, "").set("draft");
    expect(createDraftStore(storage, draftKey("user-b", "course:one"), "").getSnapshot().value).toBe("");
    expect(createDraftStore(storage, draftKey("user-a", "course:two"), "").getSnapshot().value).toBe("");
  });
  it("keeps the draft when the server has newer data and flags the difference", () => {
    const { storage } = setup();
    createDraftStore(storage, "course", "original").set("my edit");
    expect(createDraftStore(storage, "course", "someone else's edit").getSnapshot()).toMatchObject({ value: "my edit", conflict: true });
  });
  it("clears only the acknowledged revision, preserving typing during a save", () => {
    const { storage } = setup();
    const store = createDraftStore(storage, "course", "original");
    store.set("submitted");
    store.set("typed while saving");
    store.commit("submitted");
    expect(createDraftStore(storage, "course", "submitted").getSnapshot().value).toBe("typed while saving");
    store.commit("typed while saving");
    expect(createDraftStore(storage, "course", "typed while saving").getSnapshot().dirty).toBe(false);
  });
  it("recognizes a save that reached the server before the response was lost", () => {
    const { storage, data } = setup();
    createDraftStore(storage, "course", "original").set("saved");
    expect(createDraftStore(storage, "course", "saved").getSnapshot().dirty).toBe(false);
    expect(data.size).toBe(0);
  });
  it("discards explicitly and notifies subscribers", () => {
    const { storage } = setup();
    const store = createDraftStore(storage, "course", "original");
    let changes = 0;
    const unsubscribe = store.subscribe(() => changes++);
    store.set("draft");
    store.discard();
    unsubscribe();
    expect(changes).toBe(2);
    expect(store.getSnapshot().value).toBe("original");
    expect(createDraftStore(storage, "course", "original").getSnapshot().dirty).toBe(false);
  });
  it.each(["{broken", '{"version":2,"value":"bad","base":""}', '{"version":1,"value":[],"base":""}'])("ignores incompatible or corrupt data: %s", (raw) => {
    const { storage, data } = setup();
    data.set("course", raw);
    expect(createDraftStore(storage, "course", "original").getSnapshot().value).toBe("original");
  });
  it("keeps edits in memory and reports unavailable storage", () => {
    const store = createDraftStore(() => { throw new Error("blocked"); }, "course", "original");
    store.set("draft");
    expect(store.getSnapshot()).toMatchObject({ value: "draft", dirty: true, unavailable: true });
  });
});
