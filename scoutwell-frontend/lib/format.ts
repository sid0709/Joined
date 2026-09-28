import { LOCALE } from "./config";

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString(LOCALE)} ${count === 1 ? singular : plural}`;
}

export function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function newId() {
  return crypto.randomUUID();
}
