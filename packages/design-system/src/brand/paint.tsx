import { useId, type CSSProperties } from "react";

/** A gradient palette from brand.css: five stops at 0, 25, 50, 75, 100%. */
export type BrandRamp = "original" | "blue";

/** A solid fill from brand.css. */
export type BrandSolid = "meta-blue" | "black" | "white";

/** Start and end of a linear gradient, in the artwork's own coordinates. */
export interface GradientVector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const STOPS = [1, 2, 3, 4, 5] as const;

/** A per-instance gradient id that is safe inside `url(#…)` (React ids may hold `:` or `«»`). */
export const useGradientId = () => `os-brand-${useId().replace(/[^\w-]/g, "")}`;

export const solidFill = (solid: BrandSolid): CSSProperties => ({
  fill: `var(--os-brand-${solid})`,
});

/** A userSpaceOnUse gradient whose stops read the brand ramp from brand.css. */
export function BrandGradient({
  id,
  ramp,
  vector,
}: {
  id: string;
  ramp: BrandRamp;
  vector: GradientVector;
}) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...vector}>
      {STOPS.map((stop, index) => (
        <stop
          key={stop}
          offset={index / (STOPS.length - 1)}
          style={{ stopColor: `var(--os-brand-${ramp}-${stop})` }}
        />
      ))}
    </linearGradient>
  );
}

/** Accessible name for the artwork, or hidden when it sits beside visible text. */
export const labelProps = (label: string | undefined) =>
  label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true, focusable: false } as const);
