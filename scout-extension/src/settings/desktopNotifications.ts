import type { KeyValueStore } from "../drafts";

export const DESKTOP_NOTIFICATIONS_STORAGE_KEY = "scout.desktopNotifications";
export const DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED = true;

export function parseDesktopNotificationsEnabled(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED;
}

export async function isDesktopNotificationsEnabled(store: KeyValueStore): Promise<boolean> {
  return parseDesktopNotificationsEnabled(await store.get(DESKTOP_NOTIFICATIONS_STORAGE_KEY));
}

export async function saveDesktopNotificationsEnabled(
  store: KeyValueStore,
  enabled: boolean,
): Promise<void> {
  await store.set(DESKTOP_NOTIFICATIONS_STORAGE_KEY, enabled);
}
