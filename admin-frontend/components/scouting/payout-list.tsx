import { EmptyState, List, ListItem, Text } from "sid-ui";
import { formatMoney, type Payout } from "@joined/scout";
import { ageLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

/** Requested payouts, oldest first; each opens the payouts page. */
export function PayoutList({ rows }: { rows: Payout[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        isCompact
        title="Nothing to pay"
        description="Scouts' payout requests show up here."
      />
    );
  }
  return (
    <List density="compact">
      {rows.map((payout) => (
        <ListItem
          key={payout.id}
          href={ROUTES.payouts}
          label={`${formatMoney(payout.amount)} · ${payout.scout_name || payout.scout_email || "Scout"}`}
          description={`${payout.method.label} •••• ${payout.method.last4}`}
          endContent={
            <Text type="supporting" color="secondary">
              {ageLabel(payout.requested_at)}
            </Text>
          }
        />
      ))}
    </List>
  );
}
