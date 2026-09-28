"use client";

import { useRouter } from "next/navigation";
import { EmptyState, Stack, Table, Text, type TableColumn } from "@openseat/design-system";
import { REWARD_TYPE, formatMoney, type Earning } from "@openseat/scout";
import { EarningStatusBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/dates";
import { ROUTES } from "@/lib/routes";

/** Reward lines; a row with a job opens that submission. */
export function EarningsTable({ rows }: { rows: Earning[] }) {
  const router = useRouter();
  const columns: TableColumn<Earning>[] = [
    {
      key: "type",
      header: "Reward",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{REWARD_TYPE[row.type].label}</Text>
          <Text type="supporting" color="secondary">
            {row.job_title ? `${row.job_title} · ${row.company_name ?? ""}` : row.description}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Stack gap={0.5}>
          <EarningStatusBadge status={row.status} />
          {row.status === "held" ? (
            <Text type="supporting" color="secondary">
              Until {formatDay(row.hold_until)}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "created_at",
      header: "Earned",
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
      render: (row) => (
        <Text
          weight="semibold"
          hasTabularNumbers
          color={row.status === "clawed_back" ? "secondary" : "primary"}
        >
          {formatMoney(row.amount)}
        </Text>
      ),
    },
  ];
  return (
    <Table
      caption="Earnings"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      variant="plain"
      onRowClick={(row) => {
        if (row.submission_id) router.push(ROUTES.submission(row.submission_id));
      }}
      empty={
        <EmptyState
          isCompact
          title="No rewards yet"
          description="Approvals, settled interviews, and hires on your jobs show up here."
        />
      }
    />
  );
}
