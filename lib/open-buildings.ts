/**
 * Which building cards are expanded on the board, persisted for the session so
 * that opening a unit and pressing Back returns to the same expanded view
 * instead of collapsing everything.
 *
 * This is a small external store, read by the board through
 * `useSyncExternalStore`, rather than component state hydrated in a mount
 * effect. Server rendering returns the compressed default via
 * `getServerSnapshot` and the first post-hydration render picks up the stored
 * value — the same deferred hydration as before, without a setState in an
 * effect, and so without tripping the React Compiler lint rule that forbids
 * setting state from one.
 *
 * The in-memory value is authoritative and sessionStorage is only persistence,
 * so expanding still works when storage is unavailable (private mode, storage
 * disabled) rather than silently doing nothing.
 */

export const OPEN_BUILDINGS_KEY = "board:openBuildings";

/** Shared empty value. Returned by identity so a board that has never expanded
 *  anything keeps an `Object.is`-stable snapshot. */
const NONE: ReadonlySet<string> = new Set<string>();

export type OpenBuildingsStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => ReadonlySet<string>;
  getServerSnapshot: () => ReadonlySet<string>;
  toggle: (name: string) => void;
};

/** Built as a factory so tests get an isolated instance instead of sharing —
 *  and reordering — one module-level value. The app uses a single instance. */
export function createOpenBuildingsStore(key: string = OPEN_BUILDINGS_KEY): OpenBuildingsStore {
  /** null until a first read seeds it from sessionStorage. */
  let value: ReadonlySet<string> | null = null;
  const listeners = new Set<() => void>();

  function readStored(): ReadonlySet<string> {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed as string[]);
      }
    } catch {}
    return NONE;
  }

  /** Must be `Object.is`-stable between calls or `useSyncExternalStore` spins:
   *  the value is cached and only replaced by `toggle`, never re-parsed. */
  function getSnapshot(): ReadonlySet<string> {
    value ??= readStored();
    return value;
  }

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      return () => { listeners.delete(onStoreChange); };
    },
    getSnapshot,
    // Never touches sessionStorage: it does not exist while rendering on the
    // server, and the compressed default is what the SSR markup must show.
    getServerSnapshot: () => NONE,
    toggle(name) {
      // Reads the live value rather than a render-closure copy, so two toggles
      // in one tick compose the way a functional setState update would.
      const next = new Set(getSnapshot());
      if (next.has(name)) next.delete(name);
      else next.add(name);
      value = next;
      // A same-tab sessionStorage write fires no `storage` event, so writers
      // notify subscribers directly.
      try { sessionStorage.setItem(key, JSON.stringify([...next])); } catch {}
      for (const listener of listeners) listener();
    },
  };
}
