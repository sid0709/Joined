"use client";

import {
  Avatar,
  Badge,
  HStack,
  Rating,
  Stack,
  Table,
  Text,
  type TableColumn,
} from "@openseat/design-system";
import { formatShortDate } from "@/lib/dates";
import { OUTCOME_META, type Interview } from "@/lib/interviews";

const LOGO_SIZE = 32;

const COLUMNS: TableColumn<Interview>[] = [
  {
    key: "role",
    header: "Interview",
    render: (row) => (
      <HStack gap={3} vAlign="center">
        <Avatar name={row.company} size={LOGO_SIZE} shape="rounded" tooltip={false} />
        <Stack gap={0.5}>
          <Text weight="medium">{row.role}</Text>
          <Text type="supporting" color="secondary">
            {row.company} · {row.round}
          </Text>
        </Stack>
      </HStack>
    ),
  },
  {
    key: "date",
    header: "Date",
    sortable: true,
    sortValue: (row) => row.date.getTime(),
    render: (row) => <Text color="secondary">{formatShortDate(row.date)}</Text>,
  },
  {
    key: "outcome",
    header: "Outcome",
    render: (row) => {
      const outcome = OUTCOME_META[row.outcome ?? "waiting"];
      return <Badge label={outcome.label} variant={outcome.badge} />;
    },
  },
  {
    key: "selfRating",
    header: "How it went",
    render: (row) => (
      <Rating
        value={row.selfRating ?? 0}
        readOnly
        size="sm"
        label="How it went"
        showValue={false}
      />
    ),
  },
  {
    key: "notes",
    header: "Notes",
    render: (row) => (
      <Text type="supporting" color="secondary" maxLines={2}>
        {row.notes ?? "—"}
      </Text>
    ),
  },
];

/** Completed rounds with outcome and your own score. */
export function PastInterviews({
  rows,
  onOpen,
}: {
  rows: Interview[];
  onOpen: (id: string) => void;
}) {
  return (
    <Table
      caption="Past interviews"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => onOpen(row.id)}
      defaultSort={{ key: "date", direction: "desc" }}
    />
  );
}
