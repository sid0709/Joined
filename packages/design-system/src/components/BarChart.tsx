"use client";

import { useState } from "react";

import { segmentShares } from "./chartMath";
import { ChartTable, ChartTip, defaultFormat, type ChartTone } from "./chartParts";

export type BarDatum = {
  label: string;
  value: number;
  /** One series takes one tone; set this only to call out a single bar. */
  tone?: ChartTone;
};

const DEFAULT_HEIGHT = 200;

/**
 * Magnitude by category. `columns` grow up from one baseline with the value on each cap;
 * `bars` run left to right with the name before and the value after, for long labels and
 * ranked lists. Each mark reads out its value and share on hover and focus.
 */
export function BarChart({
  data,
  label,
  orientation = "columns",
  tone = "blue",
  height = DEFAULT_HEIGHT,
  formatValue = defaultFormat,
  hasValueLabels = true,
}: {
  data: BarDatum[];
  /** Accessible name for the chart. */
  label: string;
  orientation?: "columns" | "bars";
  tone?: ChartTone;
  /** Plot height for columns, in px. Bars size to their rows. */
  height?: number;
  formatValue?: (value: number) => string;
  hasValueLabels?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((datum) => datum.value));
  const shares = segmentShares(data.map((datum) => datum.value));
  const size = (value: number) => (max > 0 ? `${(Math.max(0, value) / max) * 100}%` : "0%");

  const handlers = (index: number) => ({
    tabIndex: 0,
    onPointerEnter: () => setActive(index),
    onPointerLeave: () => setActive(null),
    onFocus: () => setActive(index),
    onBlur: () => setActive(null),
    "aria-label": `${data[index].label}: ${formatValue(data[index].value)}`,
  });

  const tip = (index: number) => (
    <ChartTip
      left="50%"
      top={0}
      rows={[
        {
          label: `${data[index].label} · ${Math.round(shares[index])}%`,
          value: formatValue(data[index].value),
        },
      ]}
    />
  );

  return (
    <div className="os-chart">
      {orientation === "columns" ? (
        <div className="os-bars-columns" style={{ height }} role="list" aria-label={label}>
          {data.map((datum, index) => (
            <div
              key={datum.label}
              className="os-bars-column"
              role="listitem"
              data-active={active === index || undefined}
              {...handlers(index)}
            >
              <div className="os-bars-plot">
                {hasValueLabels ? (
                  <span className="os-bars-value">{formatValue(datum.value)}</span>
                ) : null}
                <span
                  className="os-bars-mark"
                  data-tone={datum.tone ?? tone}
                  style={{ height: size(datum.value) }}
                />
                {active === index ? tip(index) : null}
              </div>
              <span className="os-bars-label">{datum.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="os-bars-rows" role="list" aria-label={label}>
          {data.map((datum, index) => (
            <div
              key={datum.label}
              className="os-bars-row"
              role="listitem"
              data-active={active === index || undefined}
              {...handlers(index)}
            >
              <span className="os-bars-label">{datum.label}</span>
              <span className="os-bars-track">
                <span
                  className="os-bars-mark"
                  data-tone={datum.tone ?? tone}
                  style={{ width: size(datum.value) }}
                />
                {active === index ? tip(index) : null}
              </span>
              {hasValueLabels ? (
                <span className="os-bars-value">{formatValue(datum.value)}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <ChartTable
        caption={label}
        headers={["", "Value", "Share"]}
        rows={data.map((datum, index) => [
          datum.label,
          formatValue(datum.value),
          `${Math.round(shares[index])}%`,
        ])}
      />
    </div>
  );
}
