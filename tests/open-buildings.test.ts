import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createOpenBuildingsStore, OPEN_BUILDINGS_KEY } from "../lib/open-buildings.ts";

/** Minimal Storage stand-in. `mode` lets a test simulate storage being
 *  unavailable, the way private-mode browsers throw on access. */
function installSessionStorage(
  seed: Record<string, string> = {},
  mode: "ok" | "throws" = "ok",
) {
  const data = new Map(Object.entries(seed));
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem(k: string) {
        if (mode === "throws") throw new Error("storage disabled");
        return data.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        if (mode === "throws") throw new Error("storage disabled");
        data.set(k, v);
      },
    },
  });
  return data;
}

afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

test("getSnapshot is Object.is-stable across calls", () => {
  // The guard against useSyncExternalStore spinning forever: re-parsing the
  // stored JSON on every call would hand React a new Set each render.
  installSessionStorage({ [OPEN_BUILDINGS_KEY]: JSON.stringify(["Alder", "Birch"]) });
  const store = createOpenBuildingsStore();
  assert.equal(store.getSnapshot(), store.getSnapshot());
  assert.equal(store.getSnapshot(), store.getSnapshot());
});

test("seeds from a populated sessionStorage", () => {
  installSessionStorage({ [OPEN_BUILDINGS_KEY]: JSON.stringify(["Alder", "Birch"]) });
  const store = createOpenBuildingsStore();
  assert.deepEqual([...store.getSnapshot()].sort(), ["Alder", "Birch"]);
});

test("returns empty when storage is absent or malformed", () => {
  const seeds: Record<string, string>[] = [{}, { [OPEN_BUILDINGS_KEY]: "not json" }, { [OPEN_BUILDINGS_KEY]: "3" }];
  for (const seed of seeds) {
    installSessionStorage(seed);
    assert.equal(createOpenBuildingsStore().getSnapshot().size, 0);
  }
});

test("toggle adds, toggles again to remove, and changes identity on write", () => {
  installSessionStorage();
  const store = createOpenBuildingsStore();
  const before = store.getSnapshot();

  store.toggle("Alder");
  const afterAdd = store.getSnapshot();
  assert.notEqual(afterAdd, before, "a write must produce a new snapshot identity");
  assert.deepEqual([...afterAdd], ["Alder"]);

  store.toggle("Alder");
  assert.deepEqual([...store.getSnapshot()], []);
});

test("two toggles in one tick compose instead of clobbering", () => {
  installSessionStorage();
  const store = createOpenBuildingsStore();
  store.toggle("Alder");
  store.toggle("Birch");
  assert.deepEqual([...store.getSnapshot()].sort(), ["Alder", "Birch"]);
});

test("toggle persists to sessionStorage", () => {
  const data = installSessionStorage();
  createOpenBuildingsStore().toggle("Alder");
  assert.equal(data.get(OPEN_BUILDINGS_KEY), JSON.stringify(["Alder"]));
});

test("subscribers are notified on toggle, and not after unsubscribing", () => {
  // Same-tab sessionStorage writes fire no `storage` event, so the store has
  // to notify listeners itself or the board never re-renders.
  installSessionStorage();
  const store = createOpenBuildingsStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls++; });
  store.toggle("Alder");
  assert.equal(calls, 1);
  unsubscribe();
  store.toggle("Birch");
  assert.equal(calls, 1);
});

test("toggling still works when sessionStorage throws", () => {
  // Persistence is best-effort; the in-memory value is authoritative, so a
  // browser with storage disabled can still expand a building.
  installSessionStorage({}, "throws");
  const store = createOpenBuildingsStore();
  store.toggle("Alder");
  assert.deepEqual([...store.getSnapshot()], ["Alder"]);
});

test("getServerSnapshot is the empty default and never touches storage", () => {
  installSessionStorage({ [OPEN_BUILDINGS_KEY]: JSON.stringify(["Alder"]) }, "throws");
  const store = createOpenBuildingsStore();
  // Would throw if it read storage; must still return the compressed default
  // so SSR markup matches the pre-hydration client render.
  assert.equal(store.getServerSnapshot().size, 0);
  assert.equal(store.getServerSnapshot(), store.getServerSnapshot());
});
