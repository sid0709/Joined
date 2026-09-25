import type { ReactNode } from "react";

export interface TileProps {
  children?: ReactNode;
  /** Quiet second line — a size, a span, a hint. */
  meta?: ReactNode;
  tone?: "accent" | "neutral" | "strong";
  /** Fixed height in px, for rows and masonry demos. */
  height?: number;
}

/** A labeled placeholder block for sketching and documenting layouts. */
export function Tile({ children, meta, tone = "accent", height }: TileProps) {
  return (
    <div className={tone === "accent" ? "os-tile" : `os-tile os-tile-${tone}`} style={height ? { minHeight: height } : undefined}>
      {children}
      {meta && <span className="os-tile-meta">{meta}</span>}
    </div>
  );
}
