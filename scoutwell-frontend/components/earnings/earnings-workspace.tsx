"use client";

import { useState } from "react";
import {
  Button,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@openseat/design-system";
import { PageHeader } from "@/components/page-header";
import { StatGrid } from "@/components/stat-card";
import { EarningStatusBadge } from "@/components/status-badge";
import { HOLD_DAYS, MIN_PAYOUT_CENTS } from "@/lib/config";
import { relativeDay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { ROUTES } from "@/lib/routes";
import { canRequestPayout, earningsTotals } from "@/lib/rewards";
import { useScout } from "@/lib/scout-store";
import { ownedBy } from "@/lib/stats";
import { REWARD_TYPE_META } from "@/lib/status";
import type { Earning, EarningStatus, RewardType } from "@/lib/types";

const FILTERS: { value: "all" | EarningStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "held", label: "Held" },
  { value: "released", label: "Released" },
  { value: "paid", label: "Paid" },
];

export function EarningsWorkspace() {
  const scout = useScout();
  const user = scout.user;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const mine = user ? ownedBy(scout.state.earnings, user.id) : [];
  const totals = earningsTotals(mine);
  const rows = filter === "all" ? mine : mine.filter((item) => item.status === filter);

  if (!user) return null;

  const columns: TableColumn<Earning>[] = [
    {
      key: "type",
      header: "Reward",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{REWARD_TYPE_META[row.type as RewardType].label}</Text>
          <Text type="supporting" color="secondary">
            {row.description}
          </Text>
        </Stack>
      ),
    },
    {
      key: "amountCents",
      header: "Amount",
      sortable: true,
      sortValue: (row) => row.amountCents,
      render: (row) => (
        <Text weight="semibold" hasTabularNumbers>
          {formatCents(row.amountCents)}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <EarningStatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      header: "When",
      sortable: true,
      render: (row) => (
        <Text type="supporting">
          {relativeDay(row.createdAt)}
          {row.status === "held" ? ` · releases ${relativeDay(row.holdUntil)}` : ""}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap={6}>
      <PageHeader
        title="Earnings"
        description={`Held for ${HOLD_DAYS} days. Payouts start at ${formatCents(MIN_PAYOUT_CENTS)} after tier 2 and tax info.`}
        action={
          <Button
            label="Request payout"
            variant="primary"
            href={ROUTES.payouts}
            isDisabled={!canRequestPayout(user, mine)}
          />
        }
      />
      <StatGrid
        stats={[
          {
            label: "Held",
            value: formatCents(totals.heldCents),
            hint: "Still in the dispute window",
          },
          {
            label: "Released",
            value: formatCents(totals.releasedCents),
            hint: "Ready to transfer",
          },
          { label: "Paid", value: formatCents(totals.paidCents), hint: "Already sent" },
        ]}
      />
      <SegmentedControl
        label="Status"
        value={filter}
        onChange={(value) => setFilter(value as typeof filter)}
      >
        {FILTERS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>
      <Table
        caption="Scout earnings"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pageSize={8}
        empty={
          <EmptyState
            title="No rewards in this view"
            description="Submit jobs that produce interviews."
          />
        }
      />
    </Stack>
  );
}
