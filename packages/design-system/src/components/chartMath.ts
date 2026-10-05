/** Pure maths for the charts, kept apart from React so it is unit-testable. */

/** Each value's share of the total, in percent. All-zero input yields all zeros, never NaN. */
export function segmentShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total === 0) return values.map(() => 0);
  return values.map((value) => (Math.max(0, value) / total) * 100);
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Clean axis ticks from zero up to at least `max`: 0, 5, 10, 15 — never 0, 3.7, 7.4.
 * Returns `[0, 1]` when there is nothing to plot so an empty chart still has a frame.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0) || count < 1) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (NICE_STEPS.find((nice) => nice * magnitude >= raw) ?? 10) * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(round(tick));
  return ticks;
}

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

/** Maps a domain onto a pixel range. A flat domain maps everything to the range start. */
export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value: number) => (span === 0 ? r0 : r0 + ((value - d0) / span) * (r1 - r0));
}

export type Point = { x: number; y: number };

/** An SVG path through the points with straight segments. */
export function linePath(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${fmt(point.x)},${fmt(point.y)}`)
    .join("");
}

/** The line closed down to a baseline, for the area wash under it. */
export function areaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)}L${fmt(last.x)},${fmt(baseline)}L${fmt(first.x)},${fmt(baseline)}Z`;
}

/**
 * One ring segment from `start` to `end` (fractions of a turn, 0 at twelve o'clock),
 * between `inner` and `outer` radii around (cx, cy).
 */
export function arcPath(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  start: number,
  end: number,
): string {
  const sweep = Math.min(end - start, 0.9999);
  if (sweep <= 0) return "";
  const a0 = start * 2 * Math.PI - Math.PI / 2;
  const a1 = (start + sweep) * 2 * Math.PI - Math.PI / 2;
  const large = sweep > 0.5 ? 1 : 0;
  const p = (radius: number, angle: number) =>
    `${fmt(cx + radius * Math.cos(angle))},${fmt(cy + radius * Math.sin(angle))}`;
  return [
    `M${p(outer, a0)}`,
    `A${fmt(outer)},${fmt(outer)} 0 ${large} 1 ${p(outer, a1)}`,
    `L${p(inner, a1)}`,
    `A${fmt(inner)},${fmt(inner)} 0 ${large} 0 ${p(inner, a0)}`,
    "Z",
  ].join("");
}

function fmt(value: number) {
  return String(Math.round(value * 100) / 100);
}

/**
 * Buckets a value into one of `steps` intensity levels for a heatmap: 0 means none,
 * 1…steps scale with the value against `max`. Any positive value is at least level 1.
 */
export function heatLevel(value: number, max: number, steps = 4): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(steps, Math.max(1, Math.ceil((value / max) * steps)));
}

/** Index of the item whose x is nearest to `x` — the crosshair's snap. */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  let distance = Infinity;
  xs.forEach((value, index) => {
    const next = Math.abs(value - x);
    if (next < distance) {
      distance = next;
      best = index;
    }
  });
  return best;
}

/** Step-to-step conversion in percent; the first step is always 100. */
export function conversionRates(values: number[]): number[] {
  return values.map((value, index) => {
    if (index === 0) return 100;
    const previous = values[index - 1];
    return previous > 0 ? Math.round((value / previous) * 100) : 0;
  });
}

/** Compact figures for axes and tiles: 950, 1.2K, 12K, 3.4M. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}
