"use client";

import { createContext, useContext, type CSSProperties, type ElementType, type ReactNode } from "react";
import { TIERS, spacing, type ResponsiveTo, type SpacingStep, type Tier } from "./breakpoints";

export const GRID_COLUMNS = 12;

/** A number of tracks, the full row, or hidden at this tier. */
export type GridSpanValue = number | "full" | "hidden";

/** One value, or a value per tier. Unset tiers inherit from the tier below. */
export type Responsive<T> = T | ({ base?: T } & Partial<Record<Tier, T>>);

export interface GridSystemProps {
  children: ReactNode;
  /** Track count. */
  columns?: number;
  gap?: SpacingStep;
  /** Row gap when it should differ from the column gap. */
  rowGap?: SpacingStep;
  /** container (default) reflows by the grid's own width; viewport by the window. */
  responsiveTo?: ResponsiveTo;
  /** Vertical alignment of items within their row. */
  align?: "start" | "center" | "end" | "stretch";
  /** Backfill holes left by wide items. */
  dense?: boolean;
  as?: ElementType;
}

export interface GridColumnProps extends Partial<Record<Tier, GridSpanValue>> {
  children?: ReactNode;
  /** Span below the first tier. */
  span?: GridSpanValue;
  /** 1-based starting track, per tier if needed. */
  start?: Responsive<number>;
  /** Visual order, per tier if needed. */
  order?: Responsive<number>;
  /** Rows to cover. */
  rowSpan?: number;
  as?: ElementType;
  className?: string;
}

const ColumnsContext = createContext(GRID_COLUMNS);

function perTier<T>(value: Responsive<T> | undefined): Partial<Record<"base" | Tier, T>> {
  if (value == null) return {};
  if (typeof value === "object") return value as Partial<Record<"base" | Tier, T>>;
  return { base: value };
}

/**
 * A 12-track grid whose columns reflow per tier — the OpenSeat answer to
 * "full width on phones, halves on tablets, thirds on desktop". For
 * intrinsic, count-free reflow, use Astryx `Grid columns={{ minWidth }}`.
 */
export function GridSystem({
  children,
  columns = GRID_COLUMNS,
  gap = 4,
  rowGap,
  responsiveTo = "container",
  align = "stretch",
  dense,
  as: Tag = "div",
}: GridSystemProps) {
  const style = {
    "--os-gs-columns": columns,
    "--os-gs-gap": spacing(gap),
    "--os-gs-row-gap": spacing(rowGap ?? gap),
    "--os-gs-align": align,
  } as CSSProperties;

  return (
    <ColumnsContext.Provider value={columns}>
      <div className={`os-gs os-responsive-${responsiveTo}`}>
        <Tag className={dense ? "os-gs-grid os-gs-dense" : "os-gs-grid"} style={style}>
          {children}
        </Tag>
      </div>
    </ColumnsContext.Provider>
  );
}

/** One cell. `span`, then `sm` → `xl` override it as the grid widens. */
export function GridColumn({ children, span, start, order, rowSpan, as: Tag = "div", className, ...tiers }: GridColumnProps) {
  const columns = useContext(ColumnsContext);
  const vars: Record<string, string | number> = {};

  const spans: Partial<Record<"base" | Tier, GridSpanValue>> = { base: span ?? columns };
  for (const tier of TIERS) if (tiers[tier] != null) spans[tier] = tiers[tier];
  for (const [tier, value] of Object.entries(spans)) {
    const suffix = tier === "base" ? "" : `-${tier}`;
    if (value === "hidden") vars[`--os-gs-display${suffix}`] = "none";
    else {
      vars[`--os-gs-display${suffix}`] = "block";
      vars[`--os-gs-span${suffix}`] = value === "full" ? columns : Math.min(columns, Math.max(1, value as number));
    }
  }
  for (const [tier, value] of Object.entries(perTier(start))) vars[`--os-gs-start${tier === "base" ? "" : `-${tier}`}`] = value!;
  for (const [tier, value] of Object.entries(perTier(order))) vars[`--os-gs-order${tier === "base" ? "" : `-${tier}`}`] = value!;
  if (rowSpan) vars["--os-gs-rows"] = rowSpan;

  return (
    <Tag className={["os-gs-col", className].filter(Boolean).join(" ")} style={vars as CSSProperties}>
      {children}
    </Tag>
  );
}
