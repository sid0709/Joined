"use client";

import { useRef } from "react";

import { areaPath, linePath, linearScale } from "./chartMath";
import type { ChartTone } from "./chartParts";
import { useElementWidth } from "./Responsive";

const DEFAULT_HEIGHT = 36;
/** Keeps the end dot and its ring inside the frame. */
const INSET = 5;

/**
 * A small trend under a KpiWidget number: the line in the quiet hue, the latest point
 * marked in the accent. It has no axes; the figure above it carries the value.
 */
export function Sparkline({
  values,
  label,
  tone = "blue",
  height = DEFAULT_HEIGHT,
}: {
  values: number[];
  /** Read to screen readers, e.g. "Applications per week, last 12 weeks". */
  label: string;
  tone?: ChartTone;
  height?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frame);
  const max = Math.max(0, ...values);
  const min = Math.min(max, ...values);
  const x = linearScale([0, Math.max(1, values.length - 1)], [INSET, width - INSET]);
  const y = linearScale([min, max === min ? min + 1 : max], [height - INSET, INSET]);
  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const last = points[points.length - 1];
  const summary =
    values.length > 0 ? `${label}: from ${values[0]} to ${values[values.length - 1]}` : label;

  return (
    <div ref={frame} className="os-sparkline" style={{ height }} role="img" aria-label={summary}>
      {width > 0 && points.length > 0 ? (
        <svg width={width} height={height} data-tone={tone} aria-hidden>
          <path className="os-chart-area" d={areaPath(points, height)} />
          <path className="os-chart-line" d={linePath(points)} />
          <circle className="os-chart-dot" cx={last.x} cy={last.y} r={3.5} />
        </svg>
      ) : null}
    </div>
  );
}
