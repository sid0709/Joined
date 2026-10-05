"use client";

import { useRouter } from "next/navigation";
import { Badge, EmptyState, HStack, Stack, Table, Text, type TableColumn } from "sid-ui";
import { CHANNEL_LABEL, LEVEL_BADGE, SUBMISSION_STATUS, type AdminSubmission } from "@joined/scout";
import { ageLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { flagSummary } from "@/lib/scouting";

const AGE_WIDTH = 72;

/** Submissions for moderators: what, who, why it is here, and how long it waited. */
export function QueueTable({
  rows,
  caption,
  variant = "card",
  emptyTitle = "Queue is clear",
  emptyDescription = "Nothing is waiting on a moderator.",
}: {
  rows: AdminSubmission[];
  caption: string;
  variant?: "card" | "plain";
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const columns: TableColumn<AdminSubmission>[] = [
    {
      key: "title",
      header: "Job",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.company_name} · {row.ats ?? row.host}
          </Text>
        </Stack>
      ),
    },
    {
      key: "scout",
      header: "Scout",
      render: (row) => (
        <Stack gap={0.5}>
          <Text>{row.scout.name || row.scout.email || "Unknown"}</Text>
          <HStack gap={1}>
            {row.scout.level ? (
              <Badge label={row.scout.level} variant={LEVEL_BADGE[row.scout.level]} />
            ) : null}
            <Badge label={CHANNEL_LABEL[row.channel]} variant="neutral" />
          </HStack>
        </Stack>
      ),
    },
    {
      key: "checks",
      header: "Why it's here",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {row.spot_check ? "Random spot check" : flagSummary(row)}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.status === "approved" && row.expired ? (
          <Badge label="Expired" variant="neutral" />
        ) : (
          <Badge
            label={SUBMISSION_STATUS[row.status].label}
            variant={SUBMISSION_STATUS[row.status].badge}
          />
        ),
    },
    {
      key: "submitted_at",
      header: "Age",
      align: "end",
      width: AGE_WIDTH,
      render: (row) => (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {ageLabel(row.submitted_at)}
        </Text>
      ),
    },
  ];
  return (
    <Table
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      variant={variant}
      onRowClick={(row) => router.push(ROUTES.submission(row.id))}
      empty={<EmptyState isCompact title={emptyTitle} description={emptyDescription} />}
    />
  );
}
