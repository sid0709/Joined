import type { ReactNode } from "react";

import { VisuallyHidden } from "./Lists";

/**
 * Shared pieces for every chart: the tone names, the legend, the hover readout, and the
 * screen-reader table that keeps each value reachable without hovering.
 * Tones resolve to the theme's data tokens in styles/components/charts.css.
 */

/**
 * Categorical tones, in the fixed order series take them: blue, orange, purple, green.
 * red is kept for loss or rejection; neutral is for "other" and for remainders.
 */
export type ChartTone = "blue" | "orange" | "purple" | "green" | "red" | "neutral";

/** The order a chart assigns tones to series that do not name one. Never cycled. */
export const CHART_TONES: ChartTone[] = ["blue", "orange", "purple", "green"];

export function toneAt(index: number, tone?: ChartTone): ChartTone {
  return tone ?? CHART_TONES[index] ?? "neutral";
}

export type LegendItem = { label: string; tone: ChartTone; value?: string };

/** Swatch, name, and an optional value. The swatch mirrors the mark: a dash for lines. */
export function ChartLegend({
  items,
  mark = "dot",
}: {
  items: LegendItem[];
  mark?: "dot" | "line";
}) {
  return (
    <ul className="os-chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className="os-chart-key" data-tone={item.tone} data-mark={mark} aria-hidden />
          <span>{item.label}</span>
          {item.value ? <strong>{item.value}</strong> : null}
        </li>
      ))}
    </ul>
  );
}

export type TipRow = { label: string; value: string; tone?: ChartTone };

/** The hover readout. The value leads; the series name follows in secondary ink. */
export function ChartTip({
  title,
  rows,
  left,
  top,
  align = "center",
}: {
  title?: string;
  rows: TipRow[];
  left: number | string;
  top: number | string;
  align?: "center" | "start" | "end";
}) {
  return (
    <div className="os-chart-tip" data-align={align} style={{ left, top }} role="presentation">
      {title ? <span className="os-chart-tip-title">{title}</span> : null}
      {rows.map((row) => (
        <span key={row.label} className="os-chart-tip-row">
          {row.tone ? (
            <span className="os-chart-key" data-tone={row.tone} data-mark="line" />
          ) : null}
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Every plotted value as a table, for screen readers. */
export function ChartTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <VisuallyHidden>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </VisuallyHidden>
  );
}

export const defaultFormat = (value: number) => value.toLocaleString();
