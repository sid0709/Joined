/** Pure maths for SegmentBar, kept apart from React so it is unit-testable. */

/** Each value's share of the total, in percent. All-zero input yields all zeros, never NaN. */
export function segmentShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total === 0) return values.map(() => 0);
  return values.map((value) => (Math.max(0, value) / total) * 100);
}
