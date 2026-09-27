"use client";

import {
  Avatar,
  Badge,
  HStack,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@openseat/design-system";
import { STAGE_BY_ID, STAGES, STRONG_MATCH, type Application } from "@/lib/applications";
import { relativeDay } from "@/lib/dates";

const LOGO_SIZE = 32;
const PAGE_SIZE = 8;
const STAGE_ORDER = Object.fromEntries(STAGES.map((stage, index) => [stage.id, index]));

const COLUMNS: TableColumn<Application>[] = [
  {
    key: "title",
    header: "Role",
    sortable: true,
    render: (row) => (
      <HStack gap={3} vAlign="center">
        <Avatar name={row.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
        <Stack gap={0.5}>
          <Text weight="medium">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.company} · {row.location}
          </Text>
        </Stack>
      </HStack>
    ),
  },
  {
    key: "columnId",
    header: "Stage",
    sortable: true,
    sortValue: (row) => STAGE_ORDER[row.columnId],
    render: (row) => (
      <Badge
        label={row.closedReason ?? STAGE_BY_ID[row.columnId].title}
        variant={STAGE_BY_ID[row.columnId].badge}
      />
    ),
  },
  {
    key: "match",
    header: "Match",
    sortable: true,
    align: "end",
    render: (row) => (
      <Text
        weight="medium"
        color={row.match >= STRONG_MATCH ? "accent" : "secondary"}
        hasTabularNumbers
      >
        {row.match}%
      </Text>
    ),
  },
  { key: "salary", header: "Pay" },
  {
    key: "nextStep",
    header: "Next step",
    render: (row) => (
      <Text type="supporting" color={row.nextStep ? "primary" : "secondary"}>
        {row.nextStep ?? "—"}
      </Text>
    ),
  },
  {
    key: "updated",
    header: "Updated",
    sortable: true,
    align: "end",
    sortValue: (row) => row.updated.getTime(),
    render: (row) => (
      <Text type="supporting" color="secondary">
        {relativeDay(row.updated)}
      </Text>
    ),
  },
];

/** Every application as a sortable table; click a row for details. */
export function ApplicationList({
  rows,
  onOpen,
}: {
  rows: Application[];
  onOpen: (row: Application) => void;
}) {
  return (
    <Table
      caption="Applications"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={onOpen}
      defaultSort={{ key: "updated", direction: "desc" }}
      pageSize={PAGE_SIZE}
      empty={
        <Text color="secondary" display="block">
          No applications match.
        </Text>
      }
    />
  );
}
