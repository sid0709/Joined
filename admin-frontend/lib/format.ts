import type { TempJob } from "@/lib/jobs";

const LOCALE = "en";
/** Go's zero time is year 1. Anything older than a real listing is missing. */
const EARLIEST_SHOWN_YEAR = 1900;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < EARLIEST_SHOWN_YEAR) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < EARLIEST_SHOWN_YEAR) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatCount(value: number): string {
  return value.toLocaleString(LOCALE);
}

/** How long something has waited: "5m", "3h", "2d". */
export function ageLabel(value: string | null | undefined, now = new Date()): string {
  if (!value) return "—";
  const elapsed = now.getTime() - new Date(value).getTime();
  if (Number.isNaN(elapsed)) return "—";
  if (elapsed < HOUR) return `${Math.max(0, Math.floor(elapsed / MINUTE))}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  return `${Math.floor(elapsed / DAY)}d`;
}

export function jobLocation(job: TempJob): string {
  const details = job.metadata?.details;
  return [details?.location, details?.remote].filter(Boolean).join(" · ");
}

/** A positive whole number from a query value, or the fallback. */
export function positiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}
