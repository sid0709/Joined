import type { MeterSegment } from "@/src/shared/kit/Meter";

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STROKE_CLASS: Record<MeterSegment["tone"], string> = {
  accent: "var(--color-chart-accent)",
  soft: "var(--color-chart-accent-soft)",
  positive: "var(--color-chart-positive)",
  caution: "var(--color-chart-caution)",
  critical: "var(--color-chart-critical)",
  violet: "var(--color-chart-violet)",
  neutral: "var(--color-chart-neutral)",
};

interface DonutProps {
  segments: MeterSegment[];
  centerValue: string;
  centerLabel: string;
}

export function Donut({ segments, centerValue, centerLabel }: DonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  return (
    <svg
      className="hx-chart"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      role="img"
      aria-label={`${centerLabel}: ${centerValue}`}
    >
      <circle
        className="hx-donut-track"
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        strokeWidth={STROKE}
      />
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => {
            const length = total ? (segment.value / total) * CIRCUMFERENCE : 0;
            const node = (
              <circle
                key={segment.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={STROKE_CLASS[segment.tone]}
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(length - 2, 0)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-offset}
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            );
            offset += length;
            return node;
          })}
      </g>
      <text
        className="hx-donut-center"
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {centerValue}
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle">
        {centerLabel}
      </text>
    </svg>
  );
}
