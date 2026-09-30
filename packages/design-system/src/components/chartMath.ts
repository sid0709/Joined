/** Pure geometry for Sparkline and SegmentBar, kept apart from React so it is unit-testable. */

export type Point = { x: number; y: number };

/**
 * Maps a series onto a `width × height` box, inset by `pad` so the stroke is never clipped.
 * A flat or single-point series sits on the vertical middle instead of dividing by zero.
 */
export function sparklinePoints(values: number[], width: number, height: number, pad = 2): Point[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return values.map((value, index) => ({
    x: pad + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW),
    y: pad + (span === 0 ? innerH / 2 : innerH - ((value - min) / span) * innerH),
  }));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** An SVG path `d` string through the points; empty when there is nothing to draw. */
export function linePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
}

/** The same line closed down to the baseline, for the soft fill under a sparkline. */
export function areaPath(points: Point[], height: number, pad = 2): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const base = round(height - pad);
  return `${linePath(points)} L${round(last.x)} ${base} L${round(first.x)} ${base} Z`;
}

/** Each value's share of the total, in percent. All-zero input yields all zeros, never NaN. */
export function segmentShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total === 0) return values.map(() => 0);
  return values.map((value) => (Math.max(0, value) / total) * 100);
}
