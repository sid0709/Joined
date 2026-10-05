import { describe, expect, test } from "bun:test";

import type { KeyValueStore } from "../drafts";
import { DESKTOP_NOTIFICATIONS_STORAGE_KEY } from "../settings/desktopNotifications";

import { parseNotificationPage } from "./parse";
import { pollSubmissionStatus } from "./poll";
import type { NotificationPage, ScoutStatusNotification } from "./types";

function notice(overrides: Partial<ScoutStatusNotification> = {}): ScoutStatusNotification {
  return {
    id: "n1",
    kind: "decision",
    tone: "success",
    title: "Job approved",
    body: "Staff Engineer at Acme Labs is live in the job pool.",
    subject_id: "sub-1",
    event: "accepted",
    read: false,
    created_at: "2026-10-05T12:00:00.000Z",
    ...overrides,
  };
}

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

function page(items: ScoutStatusNotification[], next = ""): NotificationPage {
  return { data: items, next_cursor: next, unread_count: items.length };
}

describe("pollSubmissionStatus", () => {
  test("the same status never notifies twice", async () => {
    const store = memoryStore({ [DESKTOP_NOTIFICATIONS_STORAGE_KEY]: true });
    const shown: string[] = [];
    const items = [notice()];
    let listed = 0;
    const client = {
      async getMe() {
        return { user_id: "scout-1" };
      },
      async listNotifications() {
        listed += 1;
        return listed === 1 ? page([]) : page(items);
      },
    };
    const ports = {
      async applyBadge() {
        return;
      },
      async showNotification(item: ScoutStatusNotification) {
        shown.push(item.id);
      },
    };

    await pollSubmissionStatus(client, store, ports);
    await pollSubmissionStatus(client, store, ports);
    await pollSubmissionStatus(client, store, ports);

    expect(shown).toEqual(["n1"]);
  });

  test("disabled settings skip Chrome notifications", async () => {
    const store = memoryStore({ [DESKTOP_NOTIFICATIONS_STORAGE_KEY]: false });
    const shown: string[] = [];
    let listed = 0;
    const client = {
      async getMe() {
        return { user_id: "scout-1" };
      },
      async listNotifications() {
        listed += 1;
        return listed === 1 ? page([]) : page([notice()]);
      },
    };

    await pollSubmissionStatus(client, store, {
      async applyBadge() {
        return;
      },
      async showNotification(item) {
        shown.push(item.id);
      },
    });
    await pollSubmissionStatus(client, store, {
      async applyBadge() {
        return;
      },
      async showNotification(item) {
        shown.push(item.id);
      },
    });

    expect(shown).toEqual([]);
  });
});

describe("parseNotificationPage", () => {
  test("keeps valid status rows and drops corrupt payloads", () => {
    const parsed = parseNotificationPage({
      data: [notice(), { id: "bad" }, null],
      next_cursor: "n1",
      unread_count: 2,
    });
    expect(parsed).toEqual({
      data: [notice()],
      next_cursor: "n1",
      unread_count: 2,
    });
    expect(parseNotificationPage(null)).toBeNull();
    expect(parseNotificationPage({ next_cursor: "" })).toBeNull();
  });
});
