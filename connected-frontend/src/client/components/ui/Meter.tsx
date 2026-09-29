export type MeterTone =
  "accent" | "soft" | "positive" | "caution" | "critical" | "violet" | "neutral";

export interface MeterSegment {
  label: string;
  value: number;
  tone: MeterTone;
}

interface MeterProps {
  segments: MeterSegment[];
  /** Scale the bar to this total; defaults to the sum of segments. */
  total?: number;
  large?: boolean;
  label: string;
}

/** A stacked bar for progress or composition. Segments are sized against `total`. */
export function Meter({ segments, total, large, label }: MeterProps) {
  const whole = total ?? segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div
      className={large ? "hx-meter hx-meter-lg" : "hx-meter"}
      role="img"
      aria-label={`${label}: ${segments.map((segment) => `${segment.value} ${segment.label}`).join(", ")}`}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span
            key={segment.label}
            className={`hx-meter-seg hx-tone-${segment.tone}`}
            style={{ width: `${whole ? (segment.value / whole) * 100 : 0}%` }}
          />
        ))}
    </div>
  );
}

export function Legend({ segments }: { segments: MeterSegment[] }) {
  return (
    <div className="hx-legend">
      {segments.map((segment) => (
        <span key={segment.label} className="hx-legend-item">
          <span className={`hx-swatch hx-tone-${segment.tone}`} />
          {segment.label} <strong className="hx-num">{segment.value}</strong>
        </span>
      ))}
    </div>
  );
}
