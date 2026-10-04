export const MIN_DUPLICATE_WINDOW_DAYS = 1;
export const MAX_DUPLICATE_WINDOW_DAYS = 365;

export function parseDuplicateWindowDays(value) {
  const text = typeof value === "string" ? value.trim() : value;
  const days = Number(text);
  if (!Number.isInteger(days)) return null;
  if (days < MIN_DUPLICATE_WINDOW_DAYS || days > MAX_DUPLICATE_WINDOW_DAYS) return null;
  return days;
}
