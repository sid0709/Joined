import { describe, expect, test } from "bun:test";

import { SIGN_IN_TO_SUBMIT_MESSAGE } from "../api";
import type { KeyValueStore } from "../drafts";
import { DRAFT_QUEUE_STORAGE_KEY } from "../drafts";
import { DESKTOP_NOTIFICATIONS_STORAGE_KEY } from "../settings/desktopNotifications";

import { parseNotificationPage, parseStatusNotification } from "./parse";
import {
  draftsFromStorageChange,
  fetchNotificationsSince,
  pollSubmissionStatus,
  resolveBadgeAuth,
} from "./poll";
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

  test("signed-out and API errors skip polling and set badge auth", async () => {
    const store = memoryStore();
    const shown: string[] = [];
    const ports = {
      async applyBadge() {
        return;
      },
      async showNotification(item: ScoutStatusNotification) {
        shown.push(item.id);
      },
    };

    expect(
      await pollSubmissionStatus(
        {
          async getMe() {
            return null;
          },
          async listNotifications() {
            throw new Error("should not list");
          },
        },
        store,
        ports,
      ),
    ).toBe("signed-out");

    expect(
      await pollSubmissionStatus(
        {
          async getMe() {
            throw new Error("unreachable");
          },
          async listNotifications() {
            throw new Error("should not list");
          },
        },
        store,
        ports,
      ),
    ).toBe("error");
    expect(shown).toEqual([]);
  });

  test("a 401 while listing marks the badge signed-out", async () => {
    const store = memoryStore({ [DESKTOP_NOTIFICATIONS_STORAGE_KEY]: true });
    expect(
      await pollSubmissionStatus(
        {
          async getMe() {
            return { user_id: "scout-1" };
          },
          async listNotifications() {
            throw new Error(SIGN_IN_TO_SUBMIT_MESSAGE);
          },
        },
        store,
        {
          async applyBadge() {
            return;
          },
          async showNotification() {
            throw new Error("should not notify");
          },
        },
      ),
    ).toBe("signed-out");
  });

  test("a list failure marks the badge error", async () => {
    const store = memoryStore({ [DESKTOP_NOTIFICATIONS_STORAGE_KEY]: true });
    expect(
      await pollSubmissionStatus(
        {
          async getMe() {
            return { user_id: "scout-1" };
          },
          async listNotifications() {
            throw new Error("500");
          },
        },
        store,
        {
          async applyBadge() {
            return;
          },
          async showNotification() {
            throw new Error("should not notify");
          },
        },
      ),
    ).toBe("error");
  });
});

describe("poll helpers", () => {
  test("resolveBadgeAuth maps profile, empty session, and thrown errors", async () => {
    expect(await resolveBadgeAuth(async () => ({ user_id: "scout-1" }))).toBe("signed-in");
    expect(await resolveBadgeAuth(async () => null)).toBe("signed-out");
    expect(
      await resolveBadgeAuth(async () => {
        throw new Error("boom");
      }),
    ).toBe("error");
  });

  test("draftsFromStorageChange reads the local draft queue only", () => {
    expect(draftsFromStorageChange({}, "local")).toBeNull();
    expect(
      draftsFromStorageChange({ [DRAFT_QUEUE_STORAGE_KEY]: { newValue: [] } }, "sync"),
    ).toBeNull();
    expect(
      draftsFromStorageChange(
        { [DRAFT_QUEUE_STORAGE_KEY]: { newValue: [{ id: "bad" }] } },
        "local",
      ),
    ).toEqual([]);
  });

  test("fetchNotificationsSince walks next_cursor pages", async () => {
    const first = notice({ id: "n1" });
    const second = notice({ id: "n2", subject_id: "sub-2" });
    const client = {
      async getMe() {
        return { user_id: "scout-1" };
      },
      async listNotifications(since: string) {
        if (since === "") {
          return page([first], "n1");
        }
        if (since === "n1") {
          return page([second], "");
        }
        return page([]);
      },
    };
    expect(await fetchNotificationsSince(client, "")).toEqual([first, second]);
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
    expect(parseStatusNotification(null)).toBeNull();
    expect(parseStatusNotification({ id: "", title: "x", body: "y" })).toBeNull();
    expect(parseStatusNotification({ id: "n1", title: "", body: "y" })).toBeNull();
    expect(parseStatusNotification({ id: "n1", title: "Job approved" })).toBeNull();
    expect(
      parseStatusNotification({
        id: "n1",
        title: "Job approved",
        body: "ok",
        event: "accepted",
        subject_id: "sub-1",
        read: true,
        created_at: "2026-10-05T12:00:00.000Z",
      }),
    ).toMatchObject({ id: "n1", event: "accepted", subject_id: "sub-1", read: true });
  });
});
