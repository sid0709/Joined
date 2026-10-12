import { EmptyState, SectionCard, TrendChart } from "sid-ui";
import {
  alignSeries,
  formatChartTime,
  type MonitoringRange,
  type NamedSeries,
} from "@/lib/monitoring";

/** One Prometheus chart in a card, or a quiet note while there is no data yet. */
export function MonitorChart({
  title,
  description,
  lines,
  range,
  formatValue,
}: {
  title: string;
  description?: string;
  lines?: NamedSeries[];
  range: MonitoringRange;
  formatValue: (value: number) => string;
}) {
  const { times, series } = alignSeries(lines);
  return (
    <SectionCard title={title} description={description}>
      {times.length === 0 ? (
        <EmptyState
          isCompact
          title="No data yet"
          description="Prometheus has nothing for this range."
        />
      ) : (
        <TrendChart
          label={title}
          labels={times.map((at) => formatChartTime(at, range))}
          series={series}
          variant="line"
          formatValue={formatValue}
        />
      )}
    </SectionCard>
  );
}
