import { LOCALE } from "./config";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function addDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

/** "Today", "Yesterday", "In 3 days", "5 days ago". */
export function relativeDay(iso: string, now = new Date()) {
  const diff = daysBetween(now, new Date(iso));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

/** "Sep 28" this year, "Sep 28, 2025" otherwise. */
export function formatDay(iso: string, now = new Date()) {
  const date = new Date(iso);
  return date.toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "Sep 28, 3:04 PM". */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Time of day greeting for a header. */
export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
