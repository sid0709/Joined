"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  EmptyState,
  HStack,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@joined/design-system";
import {
  LEVEL_BADGE,
  VERIFICATION,
  formatMoney,
  formatRate,
  type ScoutSummary,
} from "@joined/scout";
import { formatCount, formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/nav";

type Row = ScoutSummary & { id: string };

/** Scouts with the numbers staff judge them by; a row opens the scout. */
export function ScoutTable({ rows }: { rows: ScoutSummary[] }) {
  const router = useRouter();
  const columns: TableColumn<Row>[] = [
    {
      key: "name",
      header: "Scout",
      render: ({ profile }) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{profile.name || "Unnamed"}</Text>
          <Text type="supporting" color="secondary">
            {profile.email}
          </Text>
        </Stack>
      ),
    },
    {
      key: "level",
      header: "Level",
      render: ({ profile }) => (
        <HStack gap={1} wrap="wrap">
          <Badge label={profile.level} variant={LEVEL_BADGE[profile.level]} />
          {profile.level_pinned ? <Badge label="Set by staff" variant="neutral" /> : null}
        </HStack>
      ),
    },
    {
      key: "verification",
      header: "Identity",
      render: ({ profile }) => (
        <Badge
          label={VERIFICATION[profile.verification].label}
          variant={VERIFICATION[profile.verification].badge}
        />
      ),
    },
    {
      key: "quality",
      header: "Quality",
      render: ({ metrics }) => (
        <Stack gap={0.5}>
          <Text hasTabularNumbers>{formatRate(metrics.approval_rate)} approved</Text>
          <Text type="supporting" color="secondary">
            {formatCount(metrics.approved)} of {formatCount(metrics.submitted)} ·{" "}
            {formatCount(metrics.live)} live
          </Text>
        </Stack>
      ),
    },
    {
      key: "balance",
      header: "Available",
      align: "end",
      render: ({ balance }) => (
        <Stack gap={0.5} hAlign="end">
          <Text weight="semibold" hasTabularNumbers>
            {formatMoney(balance.released)}
          </Text>
          <Text type="supporting" color="secondary">
            {formatMoney(balance.lifetime)} earned
          </Text>
        </Stack>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      align: "end",
      render: ({ profile }) => (
        <Text type="supporting" color="secondary">
          {formatDate(profile.created_at)}
        </Text>
      ),
    },
  ];
  return (
    <Table
      caption="Scouts"
      columns={columns}
      rows={rows.map((row) => ({ ...row, id: row.profile.user_id }))}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(ROUTES.scout(row.id))}
      empty={
        <EmptyState isCompact title="No scouts match" description="Try another filter or search." />
      }
    />
  );
}
