"use client";

import {
  Badge,
  MoreMenu,
  Stack,
  Table,
  Text,
  type DropdownMenuOption,
  type TableColumn,
} from "@openseat/design-system";
import {
  JOB_STATUS_META,
  POLICY_META,
  pipelineTotal,
  type CompanyJob,
  type CompanyJobStatus,
} from "@/lib/company";
import { daysBetween } from "@/lib/dates";
import { formatCount } from "@/lib/jobs";
import { PipelineBar } from "../pipeline-bar";

const PIPELINE_WIDTH = 200;
const PAGE_SIZE = 8;
const STATUS_ORDER: Record<CompanyJobStatus, number> = { open: 0, paused: 1, draft: 2, closed: 3 };

export type JobAction = "open" | "pause" | "resume" | "close" | "publish" | "reopen";

function actionsFor(
  job: CompanyJob,
  onAction: (job: CompanyJob, action: JobAction) => void,
  canEdit: boolean,
  canPublish: boolean,
): DropdownMenuOption[] {
  const act = (action: JobAction) => () => onAction(job, action);
  // Einstein AuthorizeJobUpdate: jobs.edit always; jobs.publish when opening to market.
  return [
    { label: "View details", onClick: act("open") },
    { type: "divider" },
    ...(job.status === "open" && canEdit ? [{ label: "Pause", onClick: act("pause") }] : []),
    ...(job.status === "paused" && canPublish ? [{ label: "Resume", onClick: act("resume") }] : []),
    ...(job.status === "draft" && canPublish
      ? [{ label: "Publish", onClick: act("publish") }]
      : []),
    ...(job.status === "closed" && canPublish
      ? [{ label: "Reopen job", onClick: act("reopen") }]
      : []),
    ...(job.status !== "closed" && canEdit
      ? [{ label: "Close & archive", variant: "destructive" as const, onClick: act("close") }]
      : []),
  ];
}

/** Every job with its funnel, reach, and status; row actions stay out of the row click. */
export function CompanyJobTable({
  jobs,
  onAction,
  canEdit = true,
  canPublish = true,
}: {
  jobs: CompanyJob[];
  onAction: (job: CompanyJob, action: JobAction) => void;
  /** Soft gate — jobs.edit (pause / close). */
  canEdit?: boolean;
  /** Soft gate — jobs.publish (publish / resume / reopen → open). */
  canPublish?: boolean;
}) {
  const now = new Date();
  const columns: TableColumn<CompanyJob>[] = [
    {
      key: "title",
      header: "Job",
      sortable: true,
      render: (row) => (
        <Stack gap={0.5}>
          <Text weight="semibold">{row.title}</Text>
          <Text type="supporting" color="secondary">
            {[
              row.department || row.team,
              row.location,
              `${formatCount(daysBetween(row.postedOn, now), "day")} ago`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {row.status === "closed" && row.closeReason ? (
            <Text type="supporting" color="secondary">
              Closed: {row.closeReason}
            </Text>
          ) : null}
        </Stack>
      ),
    },
    {
      key: "pipeline",
      header: "Candidates",
      sortable: true,
      width: PIPELINE_WIDTH,
      sortValue: (row) => pipelineTotal(row.pipeline),
      render: (row) => (
        <Stack gap={1}>
          <Text type="supporting" weight="semibold" hasTabularNumbers>
            {pipelineTotal(row.pipeline)}
          </Text>
          <PipelineBar pipeline={row.pipeline} hasLegend={false} />
        </Stack>
      ),
    },
    {
      key: "views",
      header: "Views",
      align: "end",
      sortable: true,
      render: (row) => (
        <Text hasTabularNumbers color="secondary">
          {row.views.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "policy",
      header: "Assisted",
      render: (row) => (
        <Text type="supporting" color="secondary">
          {row.policy === "cap" && row.dailyCap
            ? `Cap ${row.dailyCap} / day`
            : POLICY_META[row.policy].label}
        </Text>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => STATUS_ORDER[row.status],
      render: (row) => (
        <Badge
          label={row.status === "closed" ? "Archived" : JOB_STATUS_META[row.status].label}
          variant={JOB_STATUS_META[row.status].badge}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <MoreMenu
            label={`Actions for ${row.title}`}
            size="sm"
            items={actionsFor(row, onAction, canEdit, canPublish)}
          />
        </span>
      ),
    },
  ];

  return (
    <Table
      caption="Jobs"
      columns={columns}
      rows={jobs}
      rowKey={(row) => row.id}
      onRowClick={(row) => onAction(row, "open")}
      defaultSort={{ key: "status", direction: "asc" }}
      pageSize={PAGE_SIZE}
      empty={
        <Text color="secondary" display="block">
          No jobs match.
        </Text>
      }
    />
  );
}
