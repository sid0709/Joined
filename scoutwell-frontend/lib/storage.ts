import { STORAGE_EVENT, STORAGE_KEY } from "./config";
import { seedState } from "./seed";
import type { StoreState } from "./types";

const EMPTY_SNAPSHOT = "";

function isStoreState(value: unknown): value is StoreState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.users) &&
    Array.isArray(record.submissions) &&
    Array.isArray(record.earnings) &&
    Array.isArray(record.notifications) &&
    Array.isArray(record.payouts) &&
    (record.activeUserId === null || typeof record.activeUserId === "string")
  );
}

export function parseStore(snapshot: string): StoreState {
  if (!snapshot) return seedState();
  try {
    const parsed: unknown = JSON.parse(snapshot);
    return isStoreState(parsed) ? parsed : seedState();
  } catch {
    return seedState();
  }
}

export function readStoreSnapshot() {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_SNAPSHOT;
}

export function writeStore(state: StoreState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function subscribeToStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

export { EMPTY_SNAPSHOT };
