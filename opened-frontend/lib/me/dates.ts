import { startOfDay } from "@/lib/dates";

export function parseJSONDate(value: string | Date | undefined) {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function parseDay(value: string | Date | undefined) {
  if (value instanceof Date) return startOfDay(value);
  if (!value) return startOfDay(new Date());
  const [year, month, day] = value.split("-").map(Number);
  if (year && month && day) return new Date(year, month - 1, day);
  return startOfDay(parseJSONDate(value));
}

export function toDayString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
