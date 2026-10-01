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
import { CHANNEL_LABEL, type Submission } from "@joined/scout";
import { SubmissionStatusBadge } from "@/components/status-badge";
import { formatDay } from "@/lib/dates";
import { sourceLabel } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

const NUMBER_WIDTH = 96;

/** Submissions with status and live usage; a row opens the submission. */
export function SubmissionTable({
  rows,
  caption,
  compact = false,
  empty,
}: {
  rows: Submission[];
  caption: string;
  compact?: boolean;
  empty?: { title: string; description: string };
}) {
  const router = useRouter();
  const columns: TableColumn<Submission>[] = [
    {
      key: "title",
      header: "Job",
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {row.company_name}
            {row.location_text ? ` · ${row.location_text}` : ""}
          </Text>
          {compact ? null : (
            <Text type="supporting" color="secondary">
              {sourceLabel(row.host, row.ats)}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <HStack gap={1} wrap="wrap">
          <SubmissionStatusBadge submission={row} />
          {row.status === "approved" && row.hidden_job && !row.expired ? (
            <Badge label="Hidden job" variant="purple" />
          ) : null}
          {!compact && row.channel === "api" ? (
            <Badge label={CHANNEL_LABEL.api} variant="neutral" />
          ) : null}
        </HStack>
      ),
    },
    ...(compact
      ? []
      : [
          {
            key: "applications",
            header: "Applied",
            align: "end" as const,
            width: NUMBER_WIDTH,
            render: (row: Submission) => (
              <Text hasTabularNumbers color={row.job_id ? "primary" : "secondary"}>
                {row.job_id ? row.activity.applications : "—"}
              </Text>
            ),
          },
          {
            key: "interviews",
            header: "Interviews",
            align: "end" as const,
            width: NUMBER_WIDTH,
            render: (row: Submission) => (
              <Text hasTabularNumbers color={row.job_id ? "primary" : "secondary"}>
                {row.job_id ? row.activity.interviews + row.settled_interviews : "—"}
              </Text>
            ),
          },
        ]),
    {
      key: "submitted_at",
      header: "Submitted",
      align: "end",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {formatDay(row.submitted_at)}
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
      variant={compact ? "plain" : "card"}
      density={compact ? "compact" : "regular"}
      onRowClick={(row) => router.push(ROUTES.submission(row.id))}
      empty={
        <EmptyState
          isCompact
          title={empty?.title ?? "No submissions yet"}
          description={
            empty?.description ?? "Submit an official apply link to start earning on outcomes."
          }
        />
      }
    />
  );
}
