import { describe, expect, test } from "bun:test";

import type { KeyValueStore } from "../drafts";

import {
  DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED,
  DESKTOP_NOTIFICATIONS_STORAGE_KEY,
  isDesktopNotificationsEnabled,
  parseDesktopNotificationsEnabled,
  saveDesktopNotificationsEnabled,
} from "./desktopNotifications";

function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const data: Record<string, unknown> = { ...initial };
  return {
    async get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
    },
  };
}

describe("desktop notification settings", () => {
  test("unset storage defaults to enabled", () => {
    expect(parseDesktopNotificationsEnabled(undefined)).toBe(DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED);
    expect(parseDesktopNotificationsEnabled(true)).toBe(true);
    expect(parseDesktopNotificationsEnabled(false)).toBe(false);
    expect(parseDesktopNotificationsEnabled("true")).toBe(DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED);
  });

  test("round-trips the toggle through storage", async () => {
    const store = memoryStore();
    expect(await isDesktopNotificationsEnabled(store)).toBe(true);
    await saveDesktopNotificationsEnabled(store, false);
    expect(await store.get(DESKTOP_NOTIFICATIONS_STORAGE_KEY)).toBe(false);
    expect(await isDesktopNotificationsEnabled(store)).toBe(false);
    await saveDesktopNotificationsEnabled(store, true);
    expect(await isDesktopNotificationsEnabled(store)).toBe(true);
  });
});
