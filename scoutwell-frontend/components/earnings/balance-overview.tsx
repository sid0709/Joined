import { Grid, KpiWidget } from "sid-ui";
import { formatMoney, type Balance, type EarningsSummary, type RewardTable } from "@joined/scout";

import { earningsCards } from "@/lib/earnings";

const KPI_MIN_WIDTH = 150;
const KPI_MAX_COLUMNS = 3;

/** Lifetime earned, still held, and already paid — the three numbers a scout asks first. */
export function BalanceOverview({
  balance,
  summary,
  rewards,
}: {
  balance: Balance;
  summary: EarningsSummary;
  rewards: RewardTable;
}) {
  const cards = earningsCards(balance, summary);
  return (
    <Grid columns={{ minWidth: KPI_MIN_WIDTH, max: KPI_MAX_COLUMNS }} gap={4}>
      <KpiWidget
        label="Total"
        value={formatMoney(cards.total)}
        hint={`${formatMoney(cards.released)} released`}
      />
      <KpiWidget
        label="Pending"
        value={formatMoney(cards.pending)}
        hint={`Held for ${rewards.hold_days} days`}
      />
      <KpiWidget label="Paid" value={formatMoney(cards.paid)} hint="Already paid out" />
    </Grid>
  );
}
