const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOCALE = "en-US";

/** Midnight, local time. */
export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** A day offset from today — keeps sample data current whenever it is viewed. */
export function daysFromToday(offset: number) {
  const today = startOfDay(new Date());
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "5 days ago". */
export function relativeDay(date: Date, now = new Date()) {
  const diff = daysBetween(now, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

export function formatDay(date: Date) {
  return date.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric" });
}

export function formatShortDate(date: Date) {
  return date.toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}

/** "October 5, 2026" — billing renewal dates. */
export function formatLongDate(date: Date) {
  return date.toLocaleDateString(LOCALE, { year: "numeric", month: "long", day: "numeric" });
}

export function formatMonthDay(date: Date) {
  return {
    month: date.toLocaleDateString(LOCALE, { month: "short" }).toUpperCase(),
    day: String(date.getDate()),
    weekday: date.toLocaleDateString(LOCALE, { weekday: "short" }),
  };
}

/** "YYYY-MM-DD" at local midnight. */
export function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  return new Date(year, month - 1, day);
}

/** Local calendar day as "YYYY-MM-DD". */
export function formatISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A short age for an activity row. */
export function formatAgo(date: Date, now = new Date()) {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return relativeDay(date, now);
}

/** "14:30" → "2:30 PM". */
export function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The current time as a message timestamp — "3:07 PM". */
export function formatClock(date: Date) {
  return date.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}
