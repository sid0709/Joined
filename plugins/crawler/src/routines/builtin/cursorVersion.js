import { CURSOR_MIN_WRITTEN_BY } from "./constants.js";

function versionParts(value) {
  const parts = String(value ?? "")
    .split(".")
    .map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) return null;
  return parts.slice(0, 3);
}

/** Negative when left < right, 0 when equal, positive when left > right. */
export function compareSemver(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/** True when the cursor was written after 2.4.0 (V1 pagination-only cursors are not). */
export function isUsableCursorVersion(writtenBy, min = CURSOR_MIN_WRITTEN_BY) {
  const cmp = compareSemver(writtenBy, min);
  return cmp != null && cmp >= 0;
}
