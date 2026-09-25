export const DAYS_PER_WEEK = 7;
/** Month grids always show six weeks so the calendar never changes height. */
export const GRID_WEEKS = 6;
export const MONTHS_PER_YEAR = 12;
export const MS_PER_DAY = 86_400_000;
/** Fixed so server and client format dates the same way. */
export const DEFAULT_LOCALE = "en-US";

export type WeekStart = 0 | 1;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Adds months and clamps the day, so Jan 31 + 1 month is Feb 28/29. */
export function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = daysInMonth(target.getFullYear(), target.getMonth());
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  return Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}

export function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfWeek(date: Date, weekStartsOn: WeekStart) {
  const shift = (date.getDay() - weekStartsOn + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(date, -shift);
}

export function weekOf(date: Date, weekStartsOn: WeekStart) {
  const first = startOfWeek(date, weekStartsOn);
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(first, i));
}

export function monthGrid(cursor: Date, weekStartsOn: WeekStart) {
  const first = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1), weekStartsOn);
  return Array.from({ length: GRID_WEEKS * DAYS_PER_WEEK }, (_, i) => addDays(first, i));
}

export function isBetween(date: Date, start: Date, end: Date) {
  const t = startOfDay(date).getTime();
  const a = startOfDay(start).getTime();
  const b = startOfDay(end).getTime();
  return t > Math.min(a, b) && t < Math.max(a, b);
}

export function weekdayNames(weekStartsOn: WeekStart, width: "narrow" | "short", locale = DEFAULT_LOCALE) {
  const sunday = new Date(2023, 0, 1);
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) =>
    addDays(sunday, i + weekStartsOn).toLocaleDateString(locale, { weekday: width })
  );
}

export function monthNames(width: "short" | "long", locale = DEFAULT_LOCALE) {
  return Array.from({ length: MONTHS_PER_YEAR }, (_, i) => new Date(2023, i, 1).toLocaleDateString(locale, { month: width }));
}

/** Local-date ISO: "2026-09-24". */
export function toISODate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
