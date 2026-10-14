/** Browser-local, so the saved choice survives reloads and sessions on this device. */
export const AUTO_MARK_APPLIED_STORAGE_KEY = "joined.auto-mark-applied";

const ENABLED = "true";
const SERVER_SNAPSHOT = false;

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const listeners = new Set<() => void>();

function browserStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readAutoMarkApplied(store: KeyValueStore | null = browserStore()): boolean {
  try {
    return store?.getItem(AUTO_MARK_APPLIED_STORAGE_KEY) === ENABLED;
  } catch {
    return false;
  }
}

/** Turning it off removes the key, so the modal asks again on the next apply. */
export function writeAutoMarkApplied(
  enabled: boolean,
  store: KeyValueStore | null = browserStore(),
) {
  try {
    if (enabled) store?.setItem(AUTO_MARK_APPLIED_STORAGE_KEY, ENABLED);
    else store?.removeItem(AUTO_MARK_APPLIED_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the choice then lasts only until reload.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeAutoMarkApplied(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStoreChange);
  };
}

export function getAutoMarkAppliedServerSnapshot() {
  return SERVER_SNAPSHOT;
}
