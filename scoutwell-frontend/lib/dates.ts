const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOCALE = "en-US";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysFromToday(offset: number, now = new Date()) {
  const today = startOfDay(now);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
}

export function isoDaysFromToday(offset: number, now = new Date()) {
  return daysFromToday(offset, now).toISOString();
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function addDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function isSameLocalDay(iso: string, now = new Date()) {
  return daysBetween(new Date(iso), now) === 0;
}

export function relativeDay(iso: string, now = new Date()) {
  const diff = daysBetween(now, new Date(iso));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
  });
}
