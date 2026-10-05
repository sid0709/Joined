"use client";

import { useState } from "react";

import { arcPath, segmentShares } from "./chartMath";
import { ChartTable, defaultFormat, toneAt, type ChartTone } from "./chartParts";

export type DonutSlice = {
  label: string;
  value: number;
  tone?: ChartTone;
};

const DEFAULT_SIZE = 168;
const RING = 0.22;
/** The 2px surface gap between slices, in px along the outer edge. */
const GAP_PX = 2;

/**
 * Part of a whole, for up to five slices. The middle shows the total, or the hovered
 * slice. The legend carries every name, value, and share, so colour never works alone.
 */
export function DonutChart({
  data,
  label,
  centerLabel = "Total",
  size = DEFAULT_SIZE,
  formatValue = defaultFormat,
}: {
  data: DonutSlice[];
  /** Accessible name for the chart. */
  label: string;
  /** Names the figure in the middle, e.g. "Applications". */
  centerLabel?: string;
  size?: number;
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const shares = segmentShares(data.map((slice) => slice.value));
  const total = data.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const outer = size / 2;
  const inner = outer * (1 - RING * 2);
  const pad = GAP_PX / (2 * Math.PI * outer);
  const visible = shares.filter((share) => share > 0).length;
  const toned = data.map((slice, index) => ({ ...slice, tone: toneAt(index, slice.tone) }));

  let start = 0;
  const arcs = toned.map((slice, index) => {
    const fraction = shares[index] / 100;
    const from = start;
    start += fraction;
    const gap = visible > 1 ? pad : 0;
    return {
      slice,
      index,
      d: fraction > 0 ? arcPath(outer, outer, inner, outer, from + gap / 2, start - gap / 2) : "",
    };
  });

  const focus = active === null ? null : toned[active];

  return (
    <div className="os-donut">
      <div className="os-donut-figure" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden>
          <circle
            className="os-donut-track"
            cx={outer}
            cy={outer}
            r={(outer + inner) / 2}
            strokeWidth={outer - inner}
          />
          {arcs.map(({ slice, index, d }) =>
            d ? (
              <path
                key={slice.label}
                d={d}
                className="os-donut-slice"
                data-tone={slice.tone}
                data-dim={active !== null && active !== index ? true : undefined}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              />
            ) : null,
          )}
        </svg>
        <div className="os-donut-center" aria-live="polite">
          <strong>{formatValue(focus ? focus.value : total)}</strong>
          <span>
            {focus ? `${focus.label} · ${Math.round(shares[active ?? 0])}%` : centerLabel}
          </span>
        </div>
      </div>
      <ul className="os-donut-legend" aria-label={label}>
        {toned.map((slice, index) => (
          <li
            key={slice.label}
            tabIndex={0}
            data-active={active === index || undefined}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            <span className="os-chart-key" data-tone={slice.tone} aria-hidden />
            <span className="os-donut-name">{slice.label}</span>
            <strong>{formatValue(slice.value)}</strong>
            <span className="os-donut-share">{Math.round(shares[index])}%</span>
          </li>
        ))}
      </ul>
      <ChartTable
        caption={label}
        headers={["", "Value", "Share"]}
        rows={data.map((slice, index) => [
          slice.label,
          formatValue(slice.value),
          `${Math.round(shares[index])}%`,
        ])}
      />
    </div>
  );
}
