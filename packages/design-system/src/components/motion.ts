/**
 * Pure motion helpers so JS-driven animation can follow the theme's motion tokens
 * (`--duration-*`, `--ease-*`) instead of hardcoding its own timing.
 */

export type Easing = (t: number) => number;
export type Box = { x: number; width: number };

const linear: Easing = (t) => t;

/** "300ms" or "0.3s" → milliseconds. Anything unreadable → 0, so motion snaps instead of breaking. */
export function parseDuration(value: string): number {
  const match = /^\s*(-?[\d.]+)\s*(ms|s)\s*$/.exec(value);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return match[2] === "s" ? amount * 1000 : amount;
}

/** "cubic-bezier(a, b, c, d)" → an easing function; keywords and junk fall back to linear. */
export function parseEasing(value: string): Easing {
  const match = /cubic-bezier\(\s*([^)]+)\)/.exec(value);
  if (!match) return linear;
  const points = match[1].split(",").map((part) => Number(part.trim()));
  if (points.length !== 4 || points.some((n) => !Number.isFinite(n))) return linear;
  const [x1, y1, x2, y2] = points as [number, number, number, number];
  return cubicBezier(x1, y1, x2, y2);
}

const NEWTON_STEPS = 8;
const BISECTION_STEPS = 24;
const EPSILON = 1e-6;

/** The CSS cubic-bezier timing function: for progress x in [0, 1], the eased y. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveT(x: number) {
    let t = x;
    for (let i = 0; i < NEWTON_STEPS; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < EPSILON) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < EPSILON) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < BISECTION_STEPS; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < EPSILON) return t;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  }

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
}

/** A box part-way from `from` to `to`. */
export function lerpBox(from: Box, to: Box, t: number): Box {
  return { x: from.x + (to.x - from.x) * t, width: from.width + (to.width - from.width) * t };
}
