"use client";

import { useState } from "react";
import {
  DonutChart,
  GridColumn,
  GridSystem,
  SectionCard,
  Stack,
  StatGrid,
  Tab,
  TabList,
  Table,
  Text,
  type DonutSlice,
  type TableColumn,
} from "sid-ui";
import {
  MONITORING_RANGES,
  formatMs,
  formatNumber,
  formatRate,
  formatShare,
  type ApiTraffic,
  type FailureCount,
  type RouteTraffic,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { MonitorChart } from "./monitor-chart";
import { MonitorFrame } from "./monitor-frame";

const PAGE_SIZE = 20;

function successShare(errorRate: number, count: number) {
  if (count <= 0) return null;
  return 1 - errorRate;
}

type Breakdown = "api" | "route" | "method";

const routeColumns: TableColumn<RouteTraffic>[] = [
  {
    key: "route",
    header: "Route",
    render: (row) => (
      <Stack gap={0.5}>
        <Text weight="semibold">{row.route || row.method || "—"}</Text>
        {row.api ? (
          <Text type="supporting" color="secondary">
            {row.api}
          </Text>
        ) : null}
      </Stack>
    ),
  },
  {
    key: "count",
    header: "Calls",
    align: "end",
    sortable: true,
    sortValue: (row) => row.count,
    render: (row) => formatNumber(row.count),
  },
  {
    key: "success",
    header: "Success",
    align: "end",
    render: (row) => formatShare(successShare(row.errorRate, row.count)),
  },
  {
    key: "requestsPerSecond",
    header: "Rate",
    align: "end",
    sortable: true,
    sortValue: (row) => row.requestsPerSecond,
    render: (row) => formatRate(row.requestsPerSecond),
  },
  { key: "p50Ms", header: "p50", align: "end", render: (row) => formatMs(row.p50Ms) },
  {
    key: "p95Ms",
    header: "p95",
    align: "end",
    sortable: true,
    sortValue: (row) => row.p95Ms ?? 0,
    render: (row) => formatMs(row.p95Ms),
  },
  { key: "p99Ms", header: "p99", align: "end", render: (row) => formatMs(row.p99Ms) },
  {
    key: "clientErrorRate",
    header: "4xx",
    align: "end",
    render: (row) => formatShare(row.clientErrorRate),
  },
  {
    key: "errorRate",
    header: "5xx",
    align: "end",
    sortable: true,
    sortValue: (row) => row.errorRate,
    render: (row) => formatShare(row.errorRate),
  },
];

const apiColumns: TableColumn<ApiTraffic>[] = [
  { key: "name", header: "API", render: (row) => <Text weight="semibold">{row.name}</Text> },
  {
    key: "count",
    header: "Calls",
    align: "end",
    sortable: true,
    sortValue: (row) => row.count,
    render: (row) => formatNumber(row.count),
  },
  {
    key: "success",
    header: "Success",
    align: "end",
    render: (row) => formatShare(successShare(row.errorRate, row.count)),
  },
  {
    key: "requestsPerSecond",
    header: "Rate",
    align: "end",
    render: (row) => formatRate(row.requestsPerSecond),
  },
  { key: "p50Ms", header: "p50", align: "end", render: (row) => formatMs(row.p50Ms) },
  {
    key: "p95Ms",
    header: "p95",
    align: "end",
    sortable: true,
    sortValue: (row) => row.p95Ms ?? 0,
    render: (row) => formatMs(row.p95Ms),
  },
  { key: "p99Ms", header: "p99", align: "end", render: (row) => formatMs(row.p99Ms) },
  {
    key: "clientErrorRate",
    header: "4xx",
    align: "end",
    render: (row) => formatShare(row.clientErrorRate),
  },
  { key: "errorRate", header: "5xx", align: "end", render: (row) => formatShare(row.errorRate) },
];

/** Five slices, which is what the donut is built for. Everything else stays in the table. */
function donutSlices(failures: FailureCount[]): DonutSlice[] {
  const bucket = (label: string, match: (status: string) => boolean) => ({
    label,
    value: failures.filter((row) => match(row.status)).reduce((sum, row) => sum + row.count, 0),
  });
  return [
    bucket("401", (status) => status === "401"),
    bucket("403", (status) => status === "403"),
    bucket("404", (status) => status === "404"),
    bucket("409 / 429", (status) => status === "409" || status === "429"),
    bucket("5xx", (status) => status.startsWith("5")),
  ].filter((slice) => slice.value > 0);
}

function TrafficBody({
  snapshot,
  range,
}: {
  snapshot: SystemSnapshot;
  range: SystemSnapshot["range"];
}) {
  const [breakdown, setBreakdown] = useState<Breakdown>("route");
  const { traffic, charts } = snapshot;
  const slices = donutSlices(traffic.failures ?? []);
  return (
    <Stack gap={5}>
      <StatGrid
        stats={[
          {
            label: "Requests",
            value: formatNumber(traffic.requests),
            hint: formatRate(traffic.requestsPerSecond),
          },
          {
            label: "Success",
            value: formatShare(traffic.successRate),
            hint: "Share that was not a 5xx",
          },
          { label: "p50", value: formatMs(traffic.p50Ms), hint: `p90 ${formatMs(traffic.p90Ms)}` },
          { label: "p95", value: formatMs(traffic.p95Ms), hint: `p99 ${formatMs(traffic.p99Ms)}` },
          { label: "4xx", value: formatShare(traffic.clientErrorRate) },
          { label: "5xx", value: formatShare(traffic.errorRate) },
          {
            label: "Unmatched",
            value: formatShare(traffic.unmatchedRate),
            hint: "Scanners and unknown paths",
          },
          {
            label: "Slow 5xx",
            value: formatNumber(traffic.slowErrors),
            hint: "Server errors slower than 30s",
          },
        ]}
      />

      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Requests per second"
            lines={charts?.traffic}
            range={range}
            formatValue={(value) => formatRate(value)}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Latency"
            lines={charts?.latency}
            range={range}
            formatValue={formatMs}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Server errors"
            description="Share of requests answered with a 5xx."
            lines={charts?.errors}
            range={range}
            formatValue={formatShare}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Failure mix"
            description="Counts over the selected range. The ring keeps the five groups that matter most."
          >
            {slices.length === 0 ? (
              <Text type="supporting" color="secondary">
                No failed requests in this range.
              </Text>
            ) : (
              <DonutChart
                data={slices}
                label="Failed requests"
                centerLabel="Failed"
                formatValue={formatNumber}
              />
            )}
          </SectionCard>
        </GridColumn>
      </GridSystem>

      <SectionCard
        title="Status codes"
        description="Every status the APIs answered with, including the ones the ring groups together."
      >
        <Table
          columns={[
            { key: "status", header: "Status", render: (row: FailureCount) => row.status },
            {
              key: "count",
              header: "Calls",
              align: "end" as const,
              render: (row: FailureCount) => formatNumber(row.count),
            },
          ]}
          rows={traffic.failures ?? []}
          rowKey={(row) => row.status}
          variant="plain"
          density="compact"
          empty="No requests in this range."
        />
      </SectionCard>

      <SectionCard
        title="Breakdown"
        description="Sorted by p95. The route list is the slowest hundred, not every path."
      >
        <Stack gap={4}>
          <TabList
            value={breakdown}
            onChange={(value) => setBreakdown(parseBreakdown(value))}
            aria-label="Breakdown"
          >
            <Tab value="api" label="APIs" />
            <Tab value="route" label="Routes" />
            <Tab value="method" label="Methods" />
          </TabList>
          {breakdown === "api" ? (
            <Table
              columns={apiColumns}
              rows={snapshot.apis ?? []}
              rowKey={(row) => row.name}
              variant="plain"
              density="compact"
              pageSize={PAGE_SIZE}
              empty="No API metrics yet."
            />
          ) : null}
          {breakdown === "route" ? (
            <Table
              columns={routeColumns}
              rows={snapshot.routes ?? []}
              rowKey={(row) => `${row.api} ${row.route}`}
              variant="plain"
              density="compact"
              pageSize={PAGE_SIZE}
              empty="No traffic in this range."
            />
          ) : null}
          {breakdown === "method" ? (
            <Table
              columns={routeColumns}
              rows={snapshot.methods ?? []}
              rowKey={(row) => row.method ?? "method"}
              variant="plain"
              density="compact"
              pageSize={PAGE_SIZE}
              empty="No traffic in this range."
            />
          ) : null}
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function parseBreakdown(value: string): Breakdown {
  if (value === "api" || value === "method" || value === "route") return value;
  return "route";
}

/** HTTP: rates, latency, failures, and a breakdown by API, route, or method. */
export function TrafficPage() {
  return (
    <MonitorFrame
      title="Traffic"
      description="How the Go APIs answered, over the selected range."
      tab="traffic"
      ranges={MONITORING_RANGES}
    >
      {(snapshot, range) => <TrafficBody snapshot={snapshot} range={range} />}
    </MonitorFrame>
  );
}
