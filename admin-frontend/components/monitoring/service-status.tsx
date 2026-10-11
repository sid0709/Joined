import { Badge, SectionCard, Stack, Table, Text, type TableColumn } from "sid-ui";
import { formatMs, formatShare, type ServiceStatus } from "@/lib/monitoring";

const KIND_LABEL: Record<ServiceStatus["kind"], string> = {
  probe: "HTTP check",
  scrape: "Metrics",
};

const columns: TableColumn<ServiceStatus>[] = [
  {
    key: "name",
    header: "Service",
    render: (row) => (
      <Stack gap={0.5}>
        <Text weight="semibold">{row.name}</Text>
        <Text type="supporting" color="secondary">
          {KIND_LABEL[row.kind]} · {row.target}
        </Text>
      </Stack>
    ),
  },
  {
    key: "up",
    header: "Status",
    render: (row) => (
      <Badge label={row.up ? "Up" : "Down"} variant={row.up ? "success" : "error"} />
    ),
  },
  { key: "uptime", header: "Uptime", align: "end", render: (row) => formatShare(row.uptime) },
  {
    key: "latencyMs",
    header: "Response",
    align: "end",
    render: (row) => (row.kind === "probe" ? formatMs(row.latencyMs) : "—"),
  },
];

/** Every site, API, and data service: up or down now, and uptime over the range. */
export function ServiceStatusCard({ services }: { services: ServiceStatus[] }) {
  const down = services.filter((service) => !service.up).length;
  return (
    <SectionCard
      title="Services"
      description={
        down === 0
          ? `All ${services.length} checks are passing.`
          : `${down} of ${services.length} checks are failing.`
      }
    >
      <Table
        columns={columns}
        rows={services}
        rowKey={(row) => `${row.kind}:${row.target}`}
        variant="plain"
        density="compact"
        empty="Prometheus has no targets yet."
      />
    </SectionCard>
  );
}
