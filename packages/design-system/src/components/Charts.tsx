import { segmentShares } from "./chartMath";

/**
 * A proportion bar that sits inside a KpiWidget or a card.
 * Colours come only from the theme's data tokens (see styles/components/charts.css).
 */

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
