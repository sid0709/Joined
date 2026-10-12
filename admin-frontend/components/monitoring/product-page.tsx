"use client";

import { Badge, SectionCard, Stack, StatGrid, Table, Text, type TableColumn } from "sid-ui";
import { formatDateTime } from "@/lib/format";
import {
  MONITORING_RANGES,
  formatMs,
  formatNumber,
  formatShare,
  type ModelStat,
  type QueueStat,
  type WorkerStat,
} from "@/lib/monitoring";
import { MonitorFrame } from "./monitor-frame";

const FEATURE_LABEL: Record<string, string> = {
  "job-parse": "Job parse",
  "job-analyze": "Job analyze",
  "company-research": "Company research",
  "company-autofill": "Company autofill",
  "duplicate-check": "Duplicate check",
  "resume-read": "Resume read",
  "migration-assist": "Migration assist",
  unspecified: "Unspecified",
};

const WORKER_LABEL: Record<string, string> = {
  "job-import": "Job import",
  "job-expiry": "Job expiry",
  "ranking-sync": "Ranking sync",
  "status-recorder": "Status recorder",
};

const modelColumns: TableColumn<ModelStat>[] = [
  {
    key: "feature",
    header: "Feature",
    render: (row) => (
      <Stack gap={0.5}>
        <Text weight="semibold">{FEATURE_LABEL[row.feature] ?? row.feature}</Text>
        <Text type="supporting" color="secondary">
          {row.model}
        </Text>
      </Stack>
    ),
  },
  {
    key: "calls",
    header: "Calls",
    align: "end",
    sortable: true,
    sortValue: (row) => row.calls,
    render: (row) => formatNumber(row.calls),
  },
  {
    key: "successRate",
    header: "Success",
    align: "end",
    render: (row) => formatShare(row.successRate),
  },
  { key: "p50Ms", header: "p50", align: "end", render: (row) => formatMs(row.p50Ms) },
  { key: "p95Ms", header: "p95", align: "end", render: (row) => formatMs(row.p95Ms) },
  { key: "retries", header: "Retries", align: "end", render: (row) => formatNumber(row.retries) },
  {
    key: "timeouts",
    header: "Timeouts",
    align: "end",
    render: (row) => formatNumber(row.timeouts),
  },
  { key: "empty", header: "Empty", align: "end", render: (row) => formatNumber(row.empty) },
  {
    key: "missingKey",
    header: "No key",
    align: "end",
    render: (row) => formatNumber(row.missingKey),
  },
  {
    key: "promptTokens",
    header: "Prompt tokens",
    align: "end",
    render: (row) => formatNumber(row.promptTokens),
  },
  {
    key: "completionTokens",
    header: "Completion tokens",
    align: "end",
    render: (row) => formatNumber(row.completionTokens),
  },
];

const workerColumns: TableColumn<WorkerStat>[] = [
  {
    key: "name",
    header: "Worker",
    render: (row) => <Text weight="semibold">{WORKER_LABEL[row.name] ?? row.name}</Text>,
  },
  {
    key: "lastSuccess",
    header: "Last success",
    render: (row) => (row.lastSuccess ? formatDateTime(row.lastSuccess) : "—"),
  },
  {
    key: "lastDurationSeconds",
    header: "Last duration",
    align: "end",
    render: (row) =>
      formatMs(row.lastDurationSeconds == null ? null : row.lastDurationSeconds * 1000),
  },
  {
    key: "lastError",
    header: "Last run",
    render: (row) =>
      row.lastSuccess == null && !row.lastError ? (
        <Badge label="No runs" variant="neutral" />
      ) : (
        <Badge
          label={row.lastError ? "Failed" : "Ok"}
          variant={row.lastError ? "error" : "success"}
        />
      ),
  },
  {
    key: "items",
    header: "Items",
    align: "end",
    render: (row) => formatNumber(row.items),
  },
];

const queueColumns: TableColumn<QueueStat>[] = [
  { key: "name", header: "Queue", render: (row) => <Text weight="semibold">{row.name}</Text> },
  { key: "count", header: "Waiting", align: "end", render: (row) => formatNumber(row.count) },
];

/** Model calls, worker heartbeats, and how much work is waiting on staff. */
export function ProductPage() {
  return (
    <MonitorFrame
      title="Product"
      description="Model calls, background workers, and the queues staff clear."
      tab="product"
      ranges={MONITORING_RANGES}
    >
      {(snapshot) => {
        const product = snapshot.product;
        const models = product.models ?? [];
        const tokens = models.reduce(
          (sum, row) => sum + row.promptTokens + row.completionTokens,
          0,
        );
        return (
          <Stack gap={5}>
            <StatGrid
              stats={[
                {
                  label: "Model calls",
                  value: formatNumber(models.reduce((sum, row) => sum + row.calls, 0)),
                },
                {
                  label: "Tokens",
                  value: formatNumber(tokens),
                  hint: "Only when the provider reports usage",
                },
                { label: "Workers seen", value: formatNumber((product.workers ?? []).length) },
                {
                  label: "Waiting",
                  value: formatNumber(
                    (product.queues ?? []).reduce((sum, row) => sum + row.count, 0),
                  ),
                  hint: "Across the staff queues below",
                },
              ]}
            />
            <SectionCard
              title="Model calls"
              description="Labeled by feature and model. No user, prompt, or dollar amount: there is no price table."
            >
              <Table
                columns={modelColumns}
                rows={models}
                rowKey={(row) => `${row.feature} ${row.model}`}
                variant="plain"
                density="compact"
                empty="No model calls in this range."
              />
            </SectionCard>
            <SectionCard
              title="Workers"
              description="The last run of each background job. Items are how many it handled in this range."
            >
              <Table
                columns={workerColumns}
                rows={product.workers ?? []}
                rowKey={(row) => row.name}
                variant="plain"
                density="compact"
                empty="No worker heartbeats yet. They show up after the next import, expiry check, ranking sync, or status recording."
              />
            </SectionCard>
            <SectionCard
              title="Queues"
              description="Point in time. These are not Prometheus series."
            >
              <Table
                columns={queueColumns}
                rows={product.queues ?? []}
                rowKey={(row) => row.name}
                variant="plain"
                density="compact"
                empty="Queue counts need the staff stores. They are empty in a console with monitoring off."
              />
            </SectionCard>
          </Stack>
        );
      }}
    </MonitorFrame>
  );
}
