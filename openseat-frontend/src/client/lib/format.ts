import { MOCK_NOW, MS_PER_DAY, MS_PER_HOUR } from "@/src/client/data/clock";

const MS_PER_MINUTE = 60_000;

const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dateYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export const money = (value: number) => moneyFormat.format(value);
export const percent = (value: number, digits = 0) => `${value.toFixed(digits)}%`;
export const ratio = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

export const shortDate = (iso: string) => dateFormat.format(new Date(iso));
export const longDate = (iso: string) => dateYearFormat.format(new Date(iso));
export const weekday = (iso: string) => weekdayFormat.format(new Date(iso));
export const clockTime = (iso: string) => `${timeFormat.format(new Date(iso))} UTC`;

/** "5 min ago", "3 hr ago", "Yesterday" — measured against the mock clock. */
export function relativeTime(iso: string): string {
  const diff = MOCK_NOW.getTime() - new Date(iso).getTime();
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < MS_PER_DAY) return `in ${Math.max(1, Math.round(ahead / MS_PER_HOUR))} hr`;
    return `in ${Math.round(ahead / MS_PER_DAY)} d`;
  }
  if (diff < MS_PER_MINUTE) return "Just now";
  if (diff < MS_PER_HOUR) return `${Math.round(diff / MS_PER_MINUTE)} min ago`;
  if (diff < MS_PER_DAY) return `${Math.round(diff / MS_PER_HOUR)} hr ago`;
  if (diff < 2 * MS_PER_DAY) return "Yesterday";
  if (diff < 14 * MS_PER_DAY) return `${Math.round(diff / MS_PER_DAY)} d ago`;
  return shortDate(iso);
}

export const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - MOCK_NOW.getTime()) / MS_PER_DAY);

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** UTC calendar day key for grouping records by day. */
export const dayKey = (iso: string | number | Date) => new Date(iso).toISOString().slice(0, 10);
