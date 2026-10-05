"use client";

import { useRouter } from "next/navigation";
import { EmptyState, Stack, Table, Text, type TableColumn } from "@joined/design-system";
import { REWARD_TYPE, formatMoney, type Earning } from "@joined/scout";

import { EarningStatusBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/dates";
import { earningJobLabel } from "@/lib/earnings";
import { ROUTES } from "@/lib/routes";

const AMOUNT_WIDTH = 128;

/** Ledger of reward lines: job, date, and amount. A job row opens that submission. */
export function EarningsList({ rows }: { rows: Earning[] }) {
  const router = useRouter();
  const columns: TableColumn<Earning>[] = [
    {
      key: "job",
      header: "Job",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{earningJobLabel(row)}</Text>
          <Text type="supporting" color="secondary">
            {REWARD_TYPE[row.type].label}
            {row.status === "held" ? ` · until ${formatDay(row.hold_until)}` : ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {formatDay(row.created_at)}
        </Text>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      width: AMOUNT_WIDTH,
      render: (row) => (
        <Stack gap={1} hAlign="end">
          <Text
            weight="semibold"
            hasTabularNumbers
            color={row.status === "clawed_back" ? "secondary" : "primary"}
          >
            {formatMoney(row.amount)}
          </Text>
          <EarningStatusBadge status={row.status} />
        </Stack>
      ),
    },
  ];

  return (
    <Table
      caption="Earnings"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      variant="card"
      onRowClick={(row) => {
        if (row.submission_id) router.push(ROUTES.submission(row.submission_id));
      }}
      empty={
        <EmptyState
          isCompact
          title="No rewards yet"
          description="Approvals, applications, settled interviews, and hires on your jobs show up here."
        />
      }
    />
  );
}
