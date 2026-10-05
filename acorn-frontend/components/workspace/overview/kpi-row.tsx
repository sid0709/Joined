import { Grid, KpiWidget, Sparkline } from "@joined/design-system";
import { deltaOf, type Summary, type Weekly } from "@/lib/workspace/stats";

const KPI_MIN_WIDTH = 200;
const KPI_COLUMNS = 4;

/** The four numbers the page leads with, each against the window before it. */
export function KpiRow({
  current,
  previous,
  trend,
}: {
  current: Summary;
  previous: Summary;
  trend: Weekly;
}) {
  return (
    <Grid columns={{ minWidth: KPI_MIN_WIDTH, max: KPI_COLUMNS }} gap={4}>
      <KpiWidget
        label="Applications sent"
        value={current.applied.toLocaleString()}
        delta={deltaOf(current.applied, previous.applied)}
        hint={`${previous.applied} in the period before`}
      >
        <Sparkline label="Applications per week" values={trend.applied} />
      </KpiWidget>
      <KpiWidget
        label="Response rate"
        value={`${current.responseRate}%`}
        delta={deltaOf(current.responseRate, previous.responseRate, { unit: "pts" })}
        hint={`${current.replied} replies from recruiters and managers`}
      >
        <Sparkline label="Reply rate per week" values={trend.rate} tone="orange" />
      </KpiWidget>
      <KpiWidget
        label="Interviews"
        value={current.interviews.toLocaleString()}
        delta={deltaOf(current.interviews, previous.interviews)}
        hint={
          current.offers ? `${current.offers} turned into offers` : "No offers yet in this period"
        }
      >
        <Sparkline label="Interviews per week" values={trend.interviews} tone="purple" />
      </KpiWidget>
      <KpiWidget
        label="Days to first reply"
        value={current.medianReplyDays === null ? "—" : String(current.medianReplyDays)}
        delta={
          current.medianReplyDays !== null && previous.medianReplyDays !== null
            ? deltaOf(current.medianReplyDays, previous.medianReplyDays, {
                unit: "d",
                lowerIsBetter: true,
              })
            : undefined
        }
        hint="Median wait after applying"
      >
        <Sparkline label="Median days to reply per week" values={trend.replyDays} tone="green" />
      </KpiWidget>
    </Grid>
  );
}
