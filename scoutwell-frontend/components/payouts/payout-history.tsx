"use client";

import { EmptyState, Stack, Table, Text, type TableColumn } from "@openseat/design-system";
import { formatMoney, type Payout } from "@openseat/scout";
import { PayoutStatusBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/dates";
import { formatCount } from "@/lib/format";

export function PayoutHistory({ rows }: { rows: Payout[] }) {
  const columns: TableColumn<Payout>[] = [
    {
      key: "requested_at",
      header: "Requested",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="medium">{formatDay(row.requested_at)}</Text>
          <Text type="supporting" color="secondary">
            {formatCount(row.earning_ids.length, "reward")}
          </Text>
        </Stack>
      ),
    },
    {
      key: "method",
      header: "To",
      render: (row) => (
        <Text type="supporting">
          {row.method.label} •••• {row.method.last4}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Stack gap={0.5}>
          <PayoutStatusBadge status={row.status} />
          {row.note ? (
            <Text type="supporting" color="secondary">
              {row.note}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatMoney(row.amount)}
        </Text>
      ),
    },
  ];
  return (
    <Table
      caption="Payouts"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      variant="plain"
      empty={
        <EmptyState isCompact title="No payouts yet" description="Requested payouts appear here." />
      }
    />
  );
}
