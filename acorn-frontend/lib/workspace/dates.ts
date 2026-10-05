/**
 * Calendar days as `YYYY-MM-DD` and times as minutes after midnight. Formatting never
 * goes through the runtime's time zone, so the server and the browser print the same
 * labels and hydration matches.
 */

export type Day = string;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_PER_HOUR = 60;
const NOON = 12;

export function dayKey(date: Date): Day {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Midday local time, so adding days never trips over a daylight-saving change. */
export function parseDay(day: Day): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, NOON);
}

export function addDays(day: Day, count: number): Day {
  const date = parseDay(day);
  date.setDate(date.getDate() + count);
  return dayKey(date);
}

export function daysBetween(from: Day, to: Day): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function weekdayOf(day: Day): number {
  return parseDay(day).getDay();
}

/** The Sunday that starts the week holding `day`. */
export function weekStart(day: Day): Day {
  return addDays(day, -weekdayOf(day));
}

/** "Sep 1". */
export function formatDay(day: Day): string {
  const [, month, date] = day.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${date ?? 1}`;
}

/** "1:19 PM". */
export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = String(minutes % MINUTES_PER_HOUR).padStart(2, "0");
  const twelve = hours % NOON === 0 ? NOON : hours % NOON;
  return `${twelve}:${mins} ${hours < NOON ? "AM" : "PM"}`;
}

/** Inbox style: the time for today, "Yesterday", then the date. */
export function formatReceived(day: Day, minutes: number, today: Day): string {
  if (day === today) return formatClock(minutes);
  if (daysBetween(day, today) === 1) return "Yesterday";
  return formatDay(day);
}
