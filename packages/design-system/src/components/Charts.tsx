import { areaPath, linePath, segmentShares, sparklinePoints } from "./chartMath";

/**
 * Two small data marks that sit inside a KpiWidget or a card: a trend line and a proportion bar.
 * Colours come only from the theme's data tokens (see styles/components/charts.css).
 */

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 32;

/** A trend line with a soft fill. Decorative unless `label` is given. */
export function Sparkline({ values, label }: { values: number[]; label?: string }) {
  const points = sparklinePoints(values, SPARK_WIDTH, SPARK_HEIGHT);
  if (points.length < 2) return null;
  return (
    <svg
      className="os-spark"
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path className="os-spark-area" d={areaPath(points, SPARK_HEIGHT)} />
      <path className="os-spark-line" d={linePath(points)} />
    </svg>
  );
}

export type SegmentTone = "blue" | "green" | "orange" | "red" | "neutral";

export type Segment = {
  label: string;
  value: number;
  tone?: SegmentTone;
  /** How the value reads in the legend and to screen readers, e.g. "$12.50". Defaults to the number. */
  display?: string;
};

/** One bar split by share, with an optional legend. Empty data renders an empty track. */
export function SegmentBar({
  segments,
  hasLegend = true,
  unit,
}: {
  segments: Segment[];
  hasLegend?: boolean;
  /** Read after each value in the accessible summary, e.g. "jobs". */
  unit?: string;
}) {
  const shares = segmentShares(segments.map((segment) => segment.value));
  const summary = segments
    .map(
      (segment) => `${segment.label} ${segment.display ?? segment.value}${unit ? ` ${unit}` : ""}`,
    )
    .join(", ");
  return (
    <div className="os-segments">
      <div className="os-segment-track" role="img" aria-label={summary}>
        {segments.map((segment, index) =>
          shares[index] ? (
            <span
              key={segment.label}
              className="os-segment"
              data-tone={segment.tone ?? "blue"}
              style={{ width: `${shares[index]}%` }}
            />
          ) : null,
        )}
      </div>
      {hasLegend ? (
        <ul className="os-segment-legend">
          {segments.map((segment) => (
            <li key={segment.label}>
              <span className="os-segment-key" data-tone={segment.tone ?? "blue"} />
              <span>{segment.label}</span>
              <strong>{segment.display ?? segment.value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
