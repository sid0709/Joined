import { SectionCard, StatGrid, Table, Text, type TableColumn } from "sid-ui";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatRate,
  formatShare,
  type Container,
  type DataServices,
} from "@/lib/monitoring";

const containerColumns: TableColumn<Container>[] = [
  { key: "name", header: "Container", render: (row) => <Text weight="semibold">{row.name}</Text> },
  { key: "group", header: "Group", render: (row) => row.group || "—" },
  {
    key: "cpuPercent",
    header: "CPU",
    align: "end",
    sortable: true,
    sortValue: (row) => row.cpuPercent,
    render: (row) => formatPercent(row.cpuPercent),
  },
  {
    key: "memoryBytes",
    header: "Memory",
    align: "end",
    sortable: true,
    sortValue: (row) => row.memoryBytes,
    render: (row) => formatBytes(row.memoryBytes),
  },
  {
    key: "hostShare",
    header: "Of host",
    align: "end",
    sortable: true,
    sortValue: (row) => row.hostShare,
    render: (row) => formatShare(row.hostShare),
  },
  {
    key: "restarts",
    header: "Restarts",
    align: "end",
    sortable: true,
    sortValue: (row) => row.restarts,
    render: (row) => formatNumber(row.restarts),
  },
  {
    key: "oomKills",
    header: "OOM",
    align: "end",
    sortable: true,
    sortValue: (row) => row.oomKills,
    render: (row) => formatNumber(row.oomKills),
  },
];

/** Every container: CPU (100% is one core), memory, and restarts over the range. */
export function ContainersCard({ containers }: { containers: Container[] }) {
  return (
    <SectionCard
      title="Containers"
      description="CPU is per core: 100% is one full core. Restarts are over the selected range."
    >
      <Table
        columns={containerColumns}
        rows={containers}
        rowKey={(row) => row.name}
        variant="plain"
        density="compact"
        empty="No container metrics yet. Is cadvisor running?"
      />
    </SectionCard>
  );
}

const SEARCH_PATH_LABEL: Record<string, string> = {
  ranked: "ranked",
  fallback: "Mongo fallback",
  catalog: "catalog",
};

function searchSummary(perSecond: Record<string, number> | null) {
  const entries = Object.entries(perSecond ?? {}).filter(([, value]) => value > 0);
  if (entries.length === 0) return { value: "—", hint: "No searches in this range" };
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const ranked = perSecond?.ranked ?? 0;
  return {
    value: formatShare(ranked / total),
    hint: entries
      .map(([path, value]) => `${SEARCH_PATH_LABEL[path] ?? path} ${formatRate(value)}`)
      .join(" · "),
  };
}

/** MongoDB, Redis, Qdrant, and how searches were answered. */
export function DataServicesCard({ data }: { data: DataServices }) {
  const search = searchSummary(data.searchesPerSecond);
  return (
    <SectionCard title="Data services">
      <StatGrid
        stats={[
          {
            label: "MongoDB",
            value: `${formatNumber(data.mongoConnections)} connections`,
            hint: `${formatRate(data.mongoOpsPerSecond, " ops/s")}`,
          },
          {
            label: "Redis cache",
            value: formatShare(data.redisHitRate),
            hint: `hit rate · ${formatBytes(data.redisMemoryBytes)} used`,
          },
          { label: "Qdrant", value: formatNumber(data.qdrantVectors), hint: "vectors indexed" },
          {
            label: "Searches ranked",
            value: search.value,
            hint:
              data.rankingEventsDropped && data.rankingEventsDropped > 0
                ? `${search.hint} · ${formatNumber(data.rankingEventsDropped)} events dropped`
                : search.hint,
          },
        ]}
      />
    </SectionCard>
  );
}
