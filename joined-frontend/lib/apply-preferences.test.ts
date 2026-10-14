import { describe, expect, test } from "bun:test";

import {
  AUTO_MARK_APPLIED_STORAGE_KEY,
  getAutoMarkAppliedServerSnapshot,
  readAutoMarkApplied,
  subscribeAutoMarkApplied,
  writeAutoMarkApplied,
} from "./apply-preferences";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("auto-mark applied preference", () => {
  test("is off until the user saves it", () => {
    expect(readAutoMarkApplied(memoryStore())).toBe(false);
    expect(getAutoMarkAppliedServerSnapshot()).toBe(false);
  });

  test("persists in the store and can be turned back off", () => {
    const store = memoryStore();
    writeAutoMarkApplied(true, store);
    expect(store.getItem(AUTO_MARK_APPLIED_STORAGE_KEY)).not.toBeNull();
    expect(readAutoMarkApplied(store)).toBe(true);
    writeAutoMarkApplied(false, store);
    expect(readAutoMarkApplied(store)).toBe(false);
    expect(store.getItem(AUTO_MARK_APPLIED_STORAGE_KEY)).toBeNull();
  });

  test("survives a store that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readAutoMarkApplied(broken)).toBe(false);
    expect(() => writeAutoMarkApplied(true, broken)).not.toThrow();
  });

  test("notifies subscribers on write until they unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeAutoMarkApplied(() => (calls += 1));
    writeAutoMarkApplied(true, memoryStore());
    expect(calls).toBe(1);
    unsubscribe();
    writeAutoMarkApplied(false, memoryStore());
    expect(calls).toBe(1);
  });
});
