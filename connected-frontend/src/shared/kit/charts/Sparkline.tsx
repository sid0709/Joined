const WIDTH = 96;
const HEIGHT = 32;
const PAD = 3;

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const step = (WIDTH - PAD * 2) / (values.length - 1);
  const points = values.map(
    (value, index) =>
      [PAD + index * step, HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2)] as const,
  );
  const line = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${HEIGHT} L${points[0][0].toFixed(1)} ${HEIGHT} Z`;
  return (
    <svg
      className="hx-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Trend over the last two weeks"
    >
      <path d={area} className="hx-area-accent" />
      <path d={line} className="hx-line-accent" />
    </svg>
  );
}
