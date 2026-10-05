import type { ScoutStatusNotification } from "./types";

export const NOTIFICATION_TYPE_BASIC = "basic";
export const NOTIFICATION_ICON_PATH = "public/icon-128.png";

export interface DesktopNotificationPort {
  create(notificationId: string, options: chrome.notifications.NotificationOptions<true>): void;
}

export function chromeDesktopNotificationPort(): DesktopNotificationPort {
  return chrome.notifications;
}

export function desktopNotificationOptions(
  item: ScoutStatusNotification,
): chrome.notifications.NotificationOptions<true> {
  return {
    type: NOTIFICATION_TYPE_BASIC,
    iconUrl: NOTIFICATION_ICON_PATH,
    title: item.title,
    message: item.body,
  };
}

export async function showDesktopNotification(
  item: ScoutStatusNotification,
  id: string,
  port: DesktopNotificationPort,
): Promise<void> {
  port.create(id, desktopNotificationOptions(item));
}
