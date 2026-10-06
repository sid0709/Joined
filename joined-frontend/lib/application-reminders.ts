import type { Application } from "@/lib/applications";
import { formatTime, relativeDay } from "@/lib/dates";

export type ReminderStatus = "none" | "upcoming" | "overdue";

export const DEFAULT_REMIND_TIME = "09:00";

export function reminderStatus(
  remindAt: Date | null | undefined,
  now = new Date(),
): ReminderStatus {
  if (!remindAt) return "none";
  return remindAt.getTime() <= now.getTime() ? "overdue" : "upcoming";
}

export function timeFromDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineDateAndTime(date: Date | null, time: string): Date | null {
  if (!date) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}

export function reminderLabel(remindAt: Date, now = new Date()) {
  const when = `${relativeDay(remindAt, now)} · ${formatTime(timeFromDate(remindAt))}`;
  const status = reminderStatus(remindAt, now);
  switch (status) {
    case "overdue":
      return `Overdue · ${when}`;
    case "upcoming":
      return `Remind ${when}`;
    case "none":
      return when;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function reminderBadge(status: ReminderStatus) {
  switch (status) {
    case "overdue":
      return { label: "Overdue", variant: "error" as const };
    case "upcoming":
      return { label: "Reminder", variant: "warning" as const };
    case "none":
      return null;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Overdue first (oldest first), then upcoming (soonest first). */
export function applicationsWithReminders(items: Application[], now = new Date()) {
  return items
    .filter((item) => reminderStatus(item.remindAt, now) !== "none")
    .sort((a, b) => (a.remindAt?.getTime() ?? 0) - (b.remindAt?.getTime() ?? 0));
}
