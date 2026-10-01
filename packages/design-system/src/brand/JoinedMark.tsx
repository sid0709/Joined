import { APP_TILE, SYMBOL } from "./geometry";
import { BRAND_NAME } from "./name";
import { BrandGradient, labelProps, solidFill, useGradientId, type BrandSolid } from "./paint";

import type { CSSProperties } from "react";

/**
 * The treatments shipped in Joined-Logo/3-App-Icon-D-Link, plus `blue`: the bare
 * symbol in the blue gradient that brightens in dark mode.
 */
export type JoinedMarkVariant = "app" | "blue" | "gradient" | "meta-blue" | "white";

export interface JoinedMarkProps {
  /** `app` is the rounded app tile; the others are the bare symbol. */
  variant?: JoinedMarkVariant;
  /** Rendered height; width follows the artwork's aspect ratio. */
  size?: CSSProperties["height"];
  /** Accessible name. Pass `""` when visible text already names the brand. */
  label?: string;
  className?: string;
}

/** Diagonal, top-left to bottom-right — as in the master files. */
const TILE_VECTOR = { x1: 35.1464, y1: 35.1464, x2: 204.854, y2: 204.854 };
const SYMBOL_VECTOR = { x1: 21.7909, y1: 15.3125, x2: 91.3536, y2: 114.306 };

/** The linked-rings symbol: the Joined app icon, or the bare mark for tight spaces. */
export function JoinedMark({
  variant = "app",
  size = "1.5rem",
  label = BRAND_NAME,
  className,
}: JoinedMarkProps) {
  const id = useGradientId();
  const svgProps = {
    className: className ? `os-brand ${className}` : "os-brand",
    style: { height: size },
    ...labelProps(label),
  };

  if (variant === "app") {
    return (
      <svg viewBox={`0 0 ${APP_TILE.size} ${APP_TILE.size}`} {...svgProps}>
        <rect
          width={APP_TILE.size}
          height={APP_TILE.size}
          rx={APP_TILE.radius}
          style={{ fill: `url(#${id})` }}
        />
        <path
          transform={`translate(${APP_TILE.symbolX} ${APP_TILE.symbolY})`}
          d={SYMBOL.d}
          style={solidFill("white")}
        />
        <defs>
          <BrandGradient id={id} ramp="blue" vector={TILE_VECTOR} />
        </defs>
      </svg>
    );
  }

  const ramp = variant === "blue" ? "adaptive" : variant === "gradient" ? "blue" : undefined;
  return (
    <svg viewBox={`0 0 ${SYMBOL.width} ${SYMBOL.height}`} {...svgProps}>
      <path
        d={SYMBOL.d}
        style={ramp ? { fill: `url(#${id})` } : solidFill(variant as BrandSolid)}
      />
      {ramp && (
        <defs>
          <BrandGradient id={id} ramp={ramp} vector={SYMBOL_VECTOR} />
        </defs>
      )}
    </svg>
  );
}
