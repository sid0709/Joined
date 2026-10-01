import { Grid, KpiWidget, SectionCard, SegmentBar, type SegmentTone } from "@joined/design-system";
import { formatMoney, type Balance, type Money, type RewardTable } from "@joined/scout";

const KPI_MIN_WIDTH = 150;
const KPI_MAX_COLUMNS = 4;

/** A reward moves through these in order, so the bar reads left to right. */
const SPLIT: { label: string; of: (balance: Balance) => Money; tone: SegmentTone }[] = [
  { label: "On hold", of: (balance) => balance.held, tone: "orange" },
  { label: "Available", of: (balance) => balance.released, tone: "blue" },
  { label: "Paying out", of: (balance) => balance.processing, tone: "neutral" },
  { label: "Paid", of: (balance) => balance.paid, tone: "green" },
];

/** Where the money is: four numbers, then one bar showing how the balance splits across them. */
export function BalanceOverview({ balance, rewards }: { balance: Balance; rewards: RewardTable }) {
  const segments = SPLIT.map(({ label, of, tone }) => ({
    label,
    value: of(balance).amount_cents,
    display: formatMoney(of(balance)),
    tone,
  }));
  const hasMoney = segments.some((segment) => segment.value > 0);

  return (
    <>
      <Grid columns={{ minWidth: KPI_MIN_WIDTH, max: KPI_MAX_COLUMNS }} gap={4}>
        <KpiWidget
          label="Available"
          value={formatMoney(balance.released)}
          hint="Ready to pay out"
        />
        <KpiWidget
          label="On hold"
          value={formatMoney(balance.held)}
          hint={`Releases after ${rewards.hold_days} days`}
        />
        <KpiWidget
          label="Paying out"
          value={formatMoney(balance.processing)}
          hint="In a requested payout"
        />
        <KpiWidget
          label="Paid"
          value={formatMoney(balance.paid)}
          hint={`${formatMoney(balance.lifetime)} earned to date`}
        />
      </Grid>
      {hasMoney ? (
        <SectionCard
          title="Where your money is"
          description="Every reward moves from held to available, then paying out, then paid."
        >
          <SegmentBar segments={segments} />
        </SectionCard>
      ) : null}
    </>
  );
}
