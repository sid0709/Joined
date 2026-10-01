import { WORDMARK } from "./geometry";
import { BRAND_NAME } from "./name";
import {
  BrandGradient,
  labelProps,
  useGradientId,
  solidFill,
  type BrandRamp,
  type BrandSolid,
} from "./paint";

import type { CSSProperties } from "react";

/** The color treatments shipped in Joined-Logo/1-Brand-Logo. */
export type JoinedLogoVariant = "original" | "blue-gradient" | "meta-blue" | "black" | "white";

export interface JoinedLogoProps {
  /** `original` is the primary mark; use `white` on dark or accent surfaces. */
  variant?: JoinedLogoVariant;
  /** Rendered height; width follows the artwork's aspect ratio. */
  height?: CSSProperties["height"];
  /** Accessible name. Pass `""` when visible text already names the brand. */
  label?: string;
  className?: string;
}

const RAMPS: Partial<Record<JoinedLogoVariant, BrandRamp>> = {
  original: "original",
  "blue-gradient": "blue",
};

/** Horizontal, left to right across the wordmark — as in the master files. */
const VECTOR = { x1: 0, y1: 114.347, x2: 854.843, y2: 114.347 };

/** The "Joined" wordmark. */
export function JoinedLogo({
  variant = "original",
  height = "1.5rem",
  label = BRAND_NAME,
  className,
}: JoinedLogoProps) {
  const id = useGradientId();
  const ramp = RAMPS[variant];
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
      className={className ? `os-brand ${className}` : "os-brand"}
      style={{ height }}
      {...labelProps(label)}
    >
      <path
        d={WORDMARK.d}
        style={ramp ? { fill: `url(#${id})` } : solidFill(variant as BrandSolid)}
      />
      {ramp && (
        <defs>
          <BrandGradient id={id} ramp={ramp} vector={VECTOR} />
        </defs>
      )}
    </svg>
  );
}
