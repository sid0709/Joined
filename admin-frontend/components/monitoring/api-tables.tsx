import { SectionCard, Stack, Table, Text, type TableColumn } from "sid-ui";
import {
  formatMs,
  formatRate,
  formatShare,
  type ApiTraffic,
  type RouteTraffic,
} from "@/lib/monitoring";

const apiColumns: TableColumn<ApiTraffic>[] = [
  { key: "name", header: "API", render: (row) => <Text weight="semibold">{row.name}</Text> },
  {
    key: "requestsPerSecond",
    header: "Requests",
    align: "end",
    render: (row) => formatRate(row.requestsPerSecond),
  },
  { key: "p50Ms", header: "p50", align: "end", render: (row) => formatMs(row.p50Ms) },
  { key: "p95Ms", header: "p95", align: "end", render: (row) => formatMs(row.p95Ms) },
  { key: "p99Ms", header: "p99", align: "end", render: (row) => formatMs(row.p99Ms) },
  { key: "errorRate", header: "5xx", align: "end", render: (row) => formatShare(row.errorRate) },
];

const routeColumns: TableColumn<RouteTraffic>[] = [
  {
    key: "route",
    header: "Route",
    render: (row) => (
      <Stack gap={0.5}>
        <Text weight="semibold">{row.route}</Text>
        <Text type="supporting" color="secondary">
          {row.api}
        </Text>
      </Stack>
    ),
  },
  {
    key: "requestsPerSecond",
    header: "Requests",
    align: "end",
    sortable: true,
    sortValue: (row) => row.requestsPerSecond,
    render: (row) => formatRate(row.requestsPerSecond),
  },
  {
    key: "p95Ms",
    header: "p95",
    align: "end",
    sortable: true,
    sortValue: (row) => row.p95Ms ?? 0,
    render: (row) => formatMs(row.p95Ms),
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

/** Each Go API's traffic over the last few minutes. */
export function ApiTrafficCard({ apis }: { apis: ApiTraffic[] }) {
  return (
    <SectionCard
      title="APIs"
      description="Requests, latency, and server errors over the last 5 minutes."
    >
      <Table
        columns={apiColumns}
        rows={apis}
        rowKey={(row) => row.name}
        variant="plain"
        density="compact"
        empty="No API metrics yet. Check METRICS_ADDR on the backends."
      />
    </SectionCard>
  );
}

/** The slowest routes over the range: where to look first when the API feels slow. */
export function SlowRoutesCard({ routes }: { routes: RouteTraffic[] }) {
  return (
    <SectionCard title="Slowest routes" description="By p95 latency over the selected range.">
      <Table
        columns={routeColumns}
        rows={routes}
        rowKey={(row) => `${row.api} ${row.route}`}
        variant="plain"
        density="compact"
        empty="No traffic in this range."
      />
    </SectionCard>
  );
}
