import type { CSSProperties } from "react";

interface HeatmapProps {
  columns: string[];
  rows: { label: string; values: number[] }[];
  labelWidth?: string;
}

const STRONG_THRESHOLD = 0.55;

/** A grid of counts where intensity shows volume — who worked on which day. */
export function Heatmap({ columns, rows, labelWidth = "8.5rem" }: HeatmapProps) {
  const max = Math.max(...rows.flatMap((row) => row.values), 1);
  return (
    <div
      className="hx-heat"
      style={{ gridTemplateColumns: `${labelWidth} repeat(${columns.length}, minmax(0, 1fr))` }}
      role="table"
      aria-label="Applications per bidder per day"
    >
      <span />
      {columns.map((column) => (
        <span key={column} className="hx-heat-label" style={{ textAlign: "center" }}>
          {column}
        </span>
      ))}
      {rows.map((row) => (
        <HeatRow key={row.label} label={row.label} values={row.values} max={max} />
      ))}
    </div>
  );
}

function HeatRow({ label, values, max }: { label: string; values: number[]; max: number }) {
  return (
    <>
      <span className="hx-heat-label hx-truncate">{label}</span>
      {values.map((value, index) => {
        const intensity = value / max;
        return (
          <span
            key={index}
            className="hx-heat-cell"
            data-strong={intensity > STRONG_THRESHOLD}
            style={{ "--heat": value ? 0.15 + intensity * 0.85 : 0 } as CSSProperties}
            title={`${label}: ${value}`}
          >
            {value || ""}
          </span>
        );
      })}
    </>
  );
}
