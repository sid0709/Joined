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

/**
 * The color treatments shipped in Joined-Logo/1-Brand-Logo, plus `blue`: the
 * blue gradient that brightens in dark mode. Blue is the everyday brand color.
 */
export type JoinedLogoVariant =
  "blue" | "blue-gradient" | "meta-blue" | "original" | "black" | "white";

export interface JoinedLogoProps {
  /** `blue` everywhere by default; `white` on accent or photo surfaces; `original` for marketing moments. */
  variant?: JoinedLogoVariant;
  /** Rendered height; width follows the artwork's aspect ratio. */
  height?: CSSProperties["height"];
  /** Accessible name. Pass `""` when visible text already names the brand. */
  label?: string;
  className?: string;
}

const RAMPS: Partial<Record<JoinedLogoVariant, BrandRamp>> = {
  blue: "adaptive",
  original: "original",
  "blue-gradient": "blue",
};

/** Horizontal, left to right across the wordmark — as in the master files. */
const VECTOR = { x1: 0, y1: 114.347, x2: 854.843, y2: 114.347 };

/** The "Joined" wordmark. */
export function JoinedLogo({
  variant = "blue",
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
