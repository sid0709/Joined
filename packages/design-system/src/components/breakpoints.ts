import { DEFAULT_WIDTH_BREAKPOINTS } from "@astryxdesign/core/theme";

/** Responsive tiers, smallest first. `base` is everything below `sm`. */
export const TIERS = ["sm", "md", "lg", "xl"] as const;
export type Tier = (typeof TIERS)[number];
export type TierOrBase = "base" | Tier;

/** How a responsive component measures width. */
export type ResponsiveTo = "container" | "viewport";

/** Viewport tiers are Astryx's own width breakpoints. */
export const VIEWPORT_TIERS: Record<Tier, number> = {
  sm: DEFAULT_WIDTH_BREAKPOINTS.sm,
  md: DEFAULT_WIDTH_BREAKPOINTS.md,
  lg: DEFAULT_WIDTH_BREAKPOINTS.lg,
  xl: DEFAULT_WIDTH_BREAKPOINTS.xl,
};

/**
 * Container tiers are smaller: a card or a sidebar never gets as wide as a
 * screen. Keep in sync with the @container rules in styles/components/responsive.css.
 */
export const CONTAINER_TIERS: Record<Tier, number> = {
  sm: 480,
  md: 640,
  lg: 800,
  xl: 1024,
};

export function tierFor(width: number, to: ResponsiveTo = "container"): TierOrBase {
  const table = to === "container" ? CONTAINER_TIERS : VIEWPORT_TIERS;
  let current: TierOrBase = "base";
  for (const tier of TIERS) if (width >= table[tier]) current = tier;
  return current;
}

/** Astryx spacing steps map to `--spacing-*` tokens; 1.5 becomes `--spacing-1-5`. */
export type SpacingStep = 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

export function spacing(step: SpacingStep) {
  return `var(--spacing-${String(step).replace(".", "-")})`;
}
