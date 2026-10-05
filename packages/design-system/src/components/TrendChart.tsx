"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { areaPath, linePath, linearScale, nearestIndex, niceTicks } from "./chartMath";
import {
  ChartLegend,
  ChartTable,
  ChartTip,
  defaultFormat,
  toneAt,
  type ChartTone,
} from "./chartParts";
import { useElementWidth } from "./Responsive";

export type TrendSeries = {
  label: string;
  values: number[];
  tone?: ChartTone;
};

const MARGIN = { top: 12, right: 12, bottom: 28, left: 36 };
const DEFAULT_HEIGHT = 240;
const Y_TICKS = 4;
/** Room each x label needs before labels start skipping. */
const X_LABEL_ROOM = 64;
const TIP_GAP = 12;

/**
 * Change over time for up to four series on one axis. Lines are 2px with a 10% wash in
 * `area`; a crosshair snaps to the nearest point and reads out every series at once.
 * Arrow keys move the readout for keyboard users; a hidden table carries every value.
 */
export function TrendChart({
  labels,
  series,
  label,
  variant = "area",
  height = DEFAULT_HEIGHT,
  formatValue = defaultFormat,
  hasLegend,
}: {
  /** One per point, e.g. week starts. */
  labels: string[];
  series: TrendSeries[];
  /** Accessible name for the chart. */
  label: string;
  variant?: "area" | "line";
  height?: number;
  formatValue?: (value: number) => string;
  /** Defaults to on for two or more series; one series is named by its card title. */
  hasLegend?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frame);
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const max = Math.max(0, ...series.flatMap((item) => item.values));
  const ticks = niceTicks(max, Y_TICKS);
  const top = ticks[ticks.length - 1];
  const count = labels.length;
  const x = linearScale([0, Math.max(1, count - 1)], [MARGIN.left, MARGIN.left + plotW]);
  const y = linearScale([0, top], [MARGIN.top + plotH, MARGIN.top]);
  const xs = labels.map((_, index) => x(index));
  const every = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotW / X_LABEL_ROOM))));
  const toned = series.map((item, index) => ({ ...item, tone: toneAt(index, item.tone) }));
  const showLegend = hasLegend ?? series.length > 1;

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!box || count === 0) return;
    setActive(nearestIndex(xs, event.clientX - box.left));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + step)));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const activeX = active === null ? 0 : xs[active];
  const tipAlign = activeX < width / 3 ? "start" : activeX > (width * 2) / 3 ? "end" : "center";

  return (
    <div className="os-chart">
      {showLegend ? (
        <ChartLegend
          mark="line"
          items={toned.map((item) => ({ label: item.label, tone: item.tone }))}
        />
      ) : null}
      <div
        ref={frame}
        className="os-chart-frame"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the arrow keys to read each point.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {width > 0 ? (
          <svg width={width} height={height} className="os-chart-svg" aria-hidden>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  className="os-chart-grid"
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text
                  className="os-chart-axis"
                  x={MARGIN.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {formatValue(tick)}
                </text>
              </g>
            ))}
            {labels.map((text, index) =>
              index % every === 0 || index === count - 1 ? (
                <text
                  key={`${text}-${index}`}
                  className="os-chart-axis"
                  x={xs[index]}
                  y={height - 8}
                  textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
                >
                  {index === count - 1 || count - 1 - index >= every ? text : ""}
                </text>
              ) : null,
            )}
            {toned.map((item) => {
              const points = item.values.map((value, index) => ({ x: xs[index], y: y(value) }));
              return (
                <g key={item.label} data-tone={item.tone}>
                  {variant === "area" ? (
                    <path className="os-chart-area" d={areaPath(points, y(0))} />
                  ) : null}
                  <path className="os-chart-line" d={linePath(points)} />
                </g>
              );
            })}
            {active !== null ? (
              <g>
                <line
                  className="os-chart-crosshair"
                  x1={activeX}
                  x2={activeX}
                  y1={MARGIN.top}
                  y2={MARGIN.top + plotH}
                />
                {toned.map((item) => (
                  <circle
                    key={item.label}
                    className="os-chart-dot"
                    data-tone={item.tone}
                    cx={activeX}
                    cy={y(item.values[active] ?? 0)}
                    r={4}
                  />
                ))}
              </g>
            ) : null}
            <rect
              className="os-chart-hit"
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotW}
              height={plotH}
              onPointerMove={onMove}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        ) : null}
        {active !== null ? (
          <ChartTip
            title={labels[active]}
            left={activeX + (tipAlign === "start" ? TIP_GAP : tipAlign === "end" ? -TIP_GAP : 0)}
            top={MARGIN.top}
            align={tipAlign}
            rows={toned.map((item) => ({
              label: item.label,
              value: formatValue(item.values[active] ?? 0),
              tone: item.tone,
            }))}
          />
        ) : null}
      </div>
      <ChartTable
        caption={label}
        headers={["", ...series.map((item) => item.label)]}
        rows={labels.map((text, index) => [
          text,
          ...series.map((item) => formatValue(item.values[index] ?? 0)),
        ])}
      />
    </div>
  );
}
