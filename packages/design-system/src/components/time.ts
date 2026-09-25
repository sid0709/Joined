/** Time values travel as 24-hour strings: "HH:mm" or "HH:mm:ss". "" means empty. */

export type HourCycle = "12h" | "24h";
export type MinuteStep = 1 | 5 | 10 | 15 | 30;
export type Meridiem = "AM" | "PM";
export type TimeUnit = "hour" | "minute" | "second";

export const MERIDIEMS = ["AM", "PM"] as const;
export const HOURS_PER_DAY = 24;
export const HOURS_PER_HALF = 12;
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_MINUTE = 60;

export interface TimeParts {
  h: number;
  m: number;
  s: number;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function wrap(n: number, span: number) {
  return ((n % span) + span) % span;
}

export function parseTime(value: string): TimeParts | null {
  if (!value) return null;
  const [h = "0", m = "0", s = "0"] = value.split(":");
  const parts = { h: Number(h), m: Number(m), s: Number(s) };
  return Number.isFinite(parts.h) && Number.isFinite(parts.m) && Number.isFinite(parts.s) ? parts : null;
}

export function formatTime({ h, m, s }: TimeParts, withSeconds: boolean) {
  const base = `${pad2(wrap(h, HOURS_PER_DAY))}:${pad2(wrap(m, MINUTES_PER_HOUR))}`;
  return withSeconds ? `${base}:${pad2(wrap(s, SECONDS_PER_MINUTE))}` : base;
}

export function to12(h: number) {
  const hour = h % HOURS_PER_HALF;
  return hour === 0 ? HOURS_PER_HALF : hour;
}

export function meridiemOf(h: number): Meridiem {
  return h >= HOURS_PER_HALF ? "PM" : "AM";
}

/** 12-hour clock hour + meridiem → 0–23. */
export function from12(hour12: number, meridiem: Meridiem) {
  return (hour12 % HOURS_PER_HALF) + (meridiem === "PM" ? HOURS_PER_HALF : 0);
}

/** Human label for a value: "9:30 AM" or "21:30". */
export function displayTime(value: string, hourCycle: HourCycle, withSeconds = false) {
  const parts = parseTime(value);
  if (!parts) return "";
  const tail = `${pad2(parts.m)}${withSeconds ? `:${pad2(parts.s)}` : ""}`;
  return hourCycle === "12h" ? `${to12(parts.h)}:${tail} ${meridiemOf(parts.h)}` : `${pad2(parts.h)}:${tail}`;
}

export function range(from: number, to: number, step = 1) {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
}

/** Minutes since midnight. */
export function minutesOf(value: string) {
  const parts = parseTime(value);
  return parts ? parts.h * MINUTES_PER_HOUR + parts.m : 0;
}

export function fromMinutes(total: number) {
  return formatTime({ h: Math.floor(total / MINUTES_PER_HOUR), m: total % MINUTES_PER_HOUR, s: 0 }, false);
}
