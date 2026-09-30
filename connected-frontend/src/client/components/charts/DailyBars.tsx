import type { DailyPoint } from "@/src/client/types/hunter";

import { shortDate, weekday } from "@/src/client/lib/format";

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 12, right: 12, bottom: 34, left: 34 };
const GRID_LINES = 4;

const niceMax = (value: number) => {
  const step = value > 60 ? 20 : value > 24 ? 10 : 5;
  return Math.max(step, Math.ceil(value / step) * step);
};

/** Daily throughput: QA-passed (solid) plus awaiting review or returned (soft), against a daily target. */
export function DailyBars({ points }: { points: DailyPoint[] }) {
  const yMax = niceMax(
    Math.max(...points.map((point) => Math.max(point.submitted, point.target)), 1),
  );
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (value: number) => PAD.top + innerH - (value / yMax) * innerH;
  const target = points[0]?.target ?? 0;

  return (
    <svg
      className="hx-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Applications submitted per day compared with the daily target"
    >
      {Array.from({ length: GRID_LINES + 1 }, (_, index) => {
        const value = (yMax / GRID_LINES) * index;
        return (
          <g key={value}>
            <line
              className="hx-chart-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
            />
            <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end">
              {Math.round(value)}
            </text>
          </g>
        );
      })}
      {points.map((point, index) => {
        const x = PAD.left + index * slot + (slot - barW) / 2;
        const passedH = (point.qaPassed / yMax) * innerH;
        const pendingH = ((point.submitted - point.qaPassed) / yMax) * innerH;
        const showLabel = points.length <= 8 || index % 2 === 0;
        return (
          <g key={point.date} className="hx-bar">
            <title>{`${shortDate(point.date)}: ${point.submitted} submitted, ${point.qaPassed} QA passed`}</title>
            <rect
              className="hx-fill-positive"
              x={x}
              y={y(0) - passedH}
              width={barW}
              height={passedH}
              rx={3}
            />
            <rect
              className="hx-fill-soft"
              x={x}
              y={y(0) - passedH - pendingH}
              width={barW}
              height={pendingH}
              rx={3}
            />
            {showLabel && (
              <text x={x + barW / 2} y={HEIGHT - 16} textAnchor="middle">
                {weekday(point.date)}
              </text>
            )}
            {showLabel && (
              <text x={x + barW / 2} y={HEIGHT - 3} textAnchor="middle">
                {shortDate(point.date).replace(/^\w+ /, "")}
              </text>
            )}
          </g>
        );
      })}
      <line
        className="hx-chart-target"
        x1={PAD.left}
        x2={WIDTH - PAD.right}
        y1={y(target)}
        y2={y(target)}
      />
      <text x={WIDTH - PAD.right} y={y(target) - 6} textAnchor="end">
        {`Daily target ${target}`}
      </text>
    </svg>
  );
}
