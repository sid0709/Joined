import type { ApplicationRecord, Bidder } from "@/src/shared/types/marketplace";

import { DailyBars } from "@/src/shared/kit/charts/DailyBars";
import { Donut } from "@/src/shared/kit/charts/Donut";
import { Heatmap } from "@/src/shared/kit/charts/Heatmap";
import { Legend, type MeterSegment } from "@/src/shared/kit/Meter";
import { Panel } from "@/src/shared/kit/Panel";
import { weekday } from "@/src/shared/lib/format";
import { dailySeries, type StatusCounts } from "@/src/shared/lib/selectors";

const HEATMAP_DAYS = 7;
const SERIES_DAYS = 14;

interface OverviewTabProps {
  apps: ApplicationRecord[];
  counts: StatusCounts;
  target: number;
  bidderRows: { bidder: Bidder; week: number[] }[];
}

export function OverviewTab({ apps, counts, target, bidderRows }: OverviewTabProps) {
  const daily = dailySeries(apps, SERIES_DAYS, target);
  const segments: MeterSegment[] = [
    { label: "QA passed", value: counts.qa_passed, tone: "positive" },
    { label: "Awaiting QA", value: counts.submitted, tone: "soft" },
    { label: "In progress", value: counts.in_progress, tone: "accent" },
    { label: "Queued", value: counts.queued, tone: "neutral" },
    { label: "Returned", value: counts.returned, tone: "caution" },
    { label: "Failed", value: counts.failed, tone: "critical" },
  ];
  const total = apps.length;
  const days = dailySeries([], HEATMAP_DAYS, 0).map((point) => weekday(point.date));

  return (
    <div className="hx-stack">
      <div className="hx-split">
        <Panel
          title="Daily throughput"
          subtitle="Delivered applications against the combined daily target"
        >
          <DailyBars points={daily} />
          <Legend
            segments={[
              {
                label: "QA passed",
                value: daily.reduce((sum, point) => sum + point.qaPassed, 0),
                tone: "positive",
              },
              {
                label: "Awaiting QA or returned",
                value: daily.reduce((sum, point) => sum + point.submitted - point.qaPassed, 0),
                tone: "soft",
              },
            ]}
          />
        </Panel>
        <Panel title="Where every link stands" subtitle={`${total} links assigned`}>
          <div className="hx-row" style={{ justifyContent: "center" }}>
            <Donut
              segments={segments}
              centerValue={`${total ? Math.round((counts.qa_passed / total) * 100) : 0}%`}
              centerLabel="QA passed"
            />
          </div>
          <Legend segments={segments} />
        </Panel>
      </div>
      <Panel
        title="Who worked when"
        subtitle="Applications delivered per bidder over the last 7 days"
      >
        <Heatmap
          columns={days}
          rows={bidderRows.map((row) => ({ label: row.bidder.name, values: row.week }))}
        />
      </Panel>
    </div>
  );
}
