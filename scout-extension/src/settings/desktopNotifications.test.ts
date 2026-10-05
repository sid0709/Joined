import { describe, expect, test } from "bun:test";

import {
  DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED,
  parseDesktopNotificationsEnabled,
} from "./desktopNotifications";

describe("desktop notification settings", () => {
  test("unset storage defaults to enabled", () => {
    expect(parseDesktopNotificationsEnabled(undefined)).toBe(DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED);
    expect(parseDesktopNotificationsEnabled(true)).toBe(true);
    expect(parseDesktopNotificationsEnabled(false)).toBe(false);
    expect(parseDesktopNotificationsEnabled("true")).toBe(DEFAULT_DESKTOP_NOTIFICATIONS_ENABLED);
  });
});
