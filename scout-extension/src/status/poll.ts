import { SIGN_IN_TO_SUBMIT_MESSAGE } from "../api";
import type { ToolbarBadgeAppearance } from "../badge";
import { toolbarBadgeAppearance, type BadgeAuthStatus } from "../badge";
import type { JobDraft, KeyValueStore } from "../drafts";
import { DRAFT_QUEUE_STORAGE_KEY, loadDraftQueue, parseDrafts } from "../drafts";
import { isDesktopNotificationsEnabled } from "../settings/desktopNotifications";

import { notificationDedupeKey, planStatusNotifications } from "./dedupe";
import { loadStatusPollState, saveStatusPollState } from "./storage";
import type { NotificationPage, ScoutStatusNotification } from "./types";

export const MAX_STATUS_POLL_PAGES = 20;

export interface StatusPollClient {
  getMe(): Promise<unknown>;
  listNotifications(since: string): Promise<NotificationPage>;
}

export interface StatusPollPorts {
  applyBadge(appearance: ToolbarBadgeAppearance): Promise<void>;
  showNotification(item: ScoutStatusNotification, id: string): Promise<void>;
}

export async function resolveBadgeAuth(getMe: StatusPollClient["getMe"]): Promise<BadgeAuthStatus> {
  try {
    const profile = await getMe();
    return profile ? "signed-in" : "signed-out";
  } catch {
    return "error";
  }
}

export async function refreshToolbarBadge(
  auth: BadgeAuthStatus,
  store: KeyValueStore,
  applyBadge: StatusPollPorts["applyBadge"],
): Promise<void> {
  const drafts = await loadDraftQueue(store);
  await applyBadge(toolbarBadgeAppearance(auth, drafts));
}

export function draftsFromStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
): JobDraft[] | null {
  if (area !== "local" || !changes[DRAFT_QUEUE_STORAGE_KEY]) {
    return null;
  }
  return parseDrafts(changes[DRAFT_QUEUE_STORAGE_KEY].newValue);
}

export async function fetchNotificationsSince(
  client: StatusPollClient,
  since: string,
): Promise<ScoutStatusNotification[]> {
  const items: ScoutStatusNotification[] = [];
  let cursor = since;
  for (let page = 0; page < MAX_STATUS_POLL_PAGES; page += 1) {
    const result = await client.listNotifications(cursor);
    items.push(...result.data);
    if (result.data.length > 0) {
      cursor = result.next_cursor || result.data[result.data.length - 1]?.id || cursor;
    }
    if (!result.next_cursor) {
      break;
    }
  }
  return items;
}

export async function pollSubmissionStatus(
  client: StatusPollClient,
  store: KeyValueStore,
  ports: StatusPollPorts,
): Promise<BadgeAuthStatus> {
  const auth = await resolveBadgeAuth(client.getMe.bind(client));
  await refreshToolbarBadge(auth, store, ports.applyBadge);
  if (auth !== "signed-in") {
    return auth;
  }

  try {
    const state = await loadStatusPollState(store);
    const items = await fetchNotificationsSince(client, state.since);
    const planned = planStatusNotifications(state, items);
    await saveStatusPollState(store, planned.state);
    if (await isDesktopNotificationsEnabled(store)) {
      for (const item of planned.toNotify) {
        await ports.showNotification(item, notificationDedupeKey(item));
      }
    }
    return auth;
  } catch (error) {
    if (error instanceof Error && error.message === SIGN_IN_TO_SUBMIT_MESSAGE) {
      await refreshToolbarBadge("signed-out", store, ports.applyBadge);
      return "signed-out";
    }
    await refreshToolbarBadge("error", store, ports.applyBadge);
    return "error";
  }
}
