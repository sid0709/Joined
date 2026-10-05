import {
  isSubmissionChangeEvent,
  type NotificationPage,
  type ScoutStatusNotification,
} from "./types";

export function parseStatusNotification(value: unknown): ScoutStatusNotification | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }
  if (typeof record.title !== "string" || record.title.length === 0) {
    return null;
  }
  if (typeof record.body !== "string") {
    return null;
  }
  const notification: ScoutStatusNotification = {
    id: record.id,
    kind: typeof record.kind === "string" ? record.kind : "",
    tone: typeof record.tone === "string" ? record.tone : "",
    title: record.title,
    body: record.body,
    read: record.read === true,
    created_at: typeof record.created_at === "string" ? record.created_at : "",
  };
  if (typeof record.subject_id === "string" && record.subject_id.length > 0) {
    notification.subject_id = record.subject_id;
  }
  if (isSubmissionChangeEvent(record.event)) {
    notification.event = record.event;
  }
  return notification;
}

export function parseNotificationPage(value: unknown): NotificationPage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.data)) {
    return null;
  }
  const data: ScoutStatusNotification[] = [];
  for (const item of record.data) {
    const notification = parseStatusNotification(item);
    if (notification) {
      data.push(notification);
    }
  }
  return {
    data,
    next_cursor: typeof record.next_cursor === "string" ? record.next_cursor : "",
    unread_count: typeof record.unread_count === "number" ? record.unread_count : 0,
  };
}
