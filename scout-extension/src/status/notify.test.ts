import { describe, expect, test } from "bun:test";

import {
  NOTIFICATION_ICON_PATH,
  NOTIFICATION_TYPE_BASIC,
  chromeDesktopNotificationPort,
  desktopNotificationOptions,
  showDesktopNotification,
} from "./notify";
import type { ScoutStatusNotification } from "./types";

const item: ScoutStatusNotification = {
  id: "n1",
  kind: "decision",
  tone: "success",
  title: "Job approved",
  body: "Staff Engineer at Acme Labs is live in the job pool.",
  subject_id: "sub-1",
  event: "accepted",
  read: false,
  created_at: "2026-10-05T12:00:00.000Z",
};

describe("desktop notifications", () => {
  test("builds a basic Chrome notification from a status row", () => {
    expect(desktopNotificationOptions(item)).toEqual({
      type: NOTIFICATION_TYPE_BASIC,
      iconUrl: NOTIFICATION_ICON_PATH,
      title: item.title,
      message: item.body,
    });
  });

  test("creates a notification with the de-dupe id", async () => {
    const created: Array<{ id: string; title: string }> = [];
    await showDesktopNotification(item, "accepted:sub-1", {
      create(notificationId, options) {
        created.push({ id: notificationId, title: options.title ?? "" });
      },
    });
    expect(created).toEqual([{ id: "accepted:sub-1", title: item.title }]);
  });

  test("chromeDesktopNotificationPort returns chrome.notifications", () => {
    const notifications = {
      create() {
        return;
      },
    };
    (globalThis as unknown as { chrome: { notifications: typeof notifications } }).chrome = {
      notifications,
    };
    expect(chromeDesktopNotificationPort()).toBe(notifications);
  });
});
