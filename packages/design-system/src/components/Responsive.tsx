"use client";

import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { spacing, tierFor, type ResponsiveTo, type SpacingStep, type Tier, type TierOrBase } from "./breakpoints";

/** Live content-box width of an element; 0 until measured. */
export function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Container tier of an element — the same tiers GridSystem uses in container mode. */
export function useContainerBreakpoint(ref: RefObject<HTMLElement | null>): TierOrBase {
  return tierFor(useElementWidth(ref), "container");
}

/** Viewport tier of the window — Astryx's own width breakpoints. */
export function useViewportBreakpoint(): TierOrBase {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return tierFor(width, "viewport");
}

export interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Marks a region that Show, Hide, and ResponsiveStack measure in container mode. */
export function ResponsiveContainer({ children, className, style }: ResponsiveContainerProps) {
  return (
    <div className={["os-responsive-container", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

export interface ResponsiveStackProps {
  children: ReactNode;
  /** Tier where the stack turns from a column into a row. */
  from?: Tier;
  gap?: SpacingStep;
  responsiveTo?: ResponsiveTo;
  /** Give every child an equal share of the row. */
  isEqual?: boolean;
  /** Cross-axis alignment once horizontal. */
  align?: "start" | "center" | "end" | "stretch";
  /** Put the last child first while stacked — e.g. an image above its copy. */
  isReversedWhenStacked?: boolean;
}

/** Stacked on narrow widths, side by side from a tier up. */
export function ResponsiveStack({
  children,
  from = "md",
  gap = 4,
  responsiveTo = "container",
  isEqual,
  align = "stretch",
  isReversedWhenStacked,
}: ResponsiveStackProps) {
  return (
    <div className={`os-rstack-root os-responsive-${responsiveTo}`}>
      <div
        className={[
          "os-rstack",
          `os-rstack-from-${from}`,
          isEqual && "os-rstack-equal",
          isReversedWhenStacked && "os-rstack-reverse",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--os-rstack-gap": spacing(gap), "--os-rstack-align": align } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

export interface ShowProps {
  children: ReactNode;
  /** Visible at this tier and wider. */
  from?: Tier;
  /** Visible below this tier. */
  below?: Tier;
  /** container reads the nearest ResponsiveContainer, GridSystem, or ResponsiveFrame. */
  responsiveTo?: ResponsiveTo;
}

/** Renders children only inside a width range. Pure CSS — no layout flash. */
export function Show({ children, from, below, responsiveTo = "container" }: ShowProps) {
  const classes = [
    "os-show",
    `os-show-${responsiveTo}`,
    from && `os-show-from-${from}`,
    below && `os-show-below-${below}`,
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={classes}>{children}</div>;
}

/** The inverse of Show: hidden inside the range. */
export function Hide({ from, below, ...props }: ShowProps) {
  return <Show {...props} from={below} below={from} />;
}
