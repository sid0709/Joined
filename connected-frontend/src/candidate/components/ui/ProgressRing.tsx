const SIZE = 112;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProgressRingProps {
  value: number;
  total: number;
  label: string;
  caption: string;
}

export function ProgressRing({ value, total, label, caption }: ProgressRingProps) {
  const fraction = total ? Math.min(1, value / total) : 0;
  return (
    <div className="bx-ring">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`${label}: ${value} of ${total}`}
      >
        <circle
          className="hx-donut-track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
        />
        <circle
          className="bx-ring-fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="bx-ring-center">
        <strong className="bx-ring-value">{value}</strong>
        <span className="hx-small hx-muted">of {total}</span>
      </div>
      <span className="hx-small hx-muted">{caption}</span>
    </div>
  );
}
