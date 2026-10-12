"use client";

import { SectionCard, Stack, StatGrid, Text } from "sid-ui";
import {
  MONITORING_RANGES,
  formatBytes,
  formatMs,
  formatNumber,
  formatRate,
  formatShare,
  type DataServices,
  type ServiceStatus,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { DataServicesCard } from "./infra-cards";
import { MonitorFrame } from "./monitor-frame";

function opsHint(ops: Record<string, number> | null) {
  const entries = Object.entries(ops ?? {}).filter(([, value]) => value > 0);
  if (entries.length === 0) return "No per-type counters";
  return entries.map(([name, value]) => `${name} ${formatRate(value)}`).join(" · ");
}

function DataBody({ data, services }: { data: DataServices; services: ServiceStatus[] }) {
  const embedder = services.find(
    (service) => service.name.includes("embedder") && service.kind === "probe",
  );
  const qdrant = services.find(
    (service) => service.name.includes("qdrant") && service.kind === "probe",
  );
  return (
    <Stack gap={5}>
      <DataServicesCard data={data} />
      <SectionCard
        title="MongoDB"
        description="Needs the exporter and MONGODB_EXPORTER_URI. Empty cards mean that user is not set, not that Mongo is down."
      >
        <StatGrid
          stats={[
            {
              label: "Connections",
              value: formatNumber(data.mongoConnections),
              hint: `${formatNumber(data.mongoAvailableConnections)} available`,
            },
            {
              label: "Operations",
              value: formatRate(data.mongoOpsPerSecond),
              hint: opsHint(data.mongoOpsByType),
            },
            {
              label: "Replication lag",
              value:
                data.mongoReplicationLagSeconds == null
                  ? "—"
                  : formatMs(data.mongoReplicationLagSeconds * 1000),
              hint: "Only when this node is in a replica set",
            },
            {
              label: "Cache",
              value: formatBytes(data.mongoCacheBytes),
              hint: "WiredTiger, currently in cache",
            },
            {
              label: "Queued",
              value: formatNumber(data.mongoQueuedReaders),
              hint: `${formatNumber(data.mongoQueuedWriters)} writers`,
            },
            { label: "Asserts", value: formatRate(data.mongoAssertsPerSecond) },
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Redis"
        description="Hit rate is over the selected range. The rest is right now."
      >
        <StatGrid
          stats={[
            {
              label: "Memory",
              value: formatBytes(data.redisMemoryBytes),
              hint:
                data.redisMaxBytes == null
                  ? "No maxmemory set"
                  : `of ${formatBytes(data.redisMaxBytes)}`,
            },
            { label: "Hit rate", value: formatShare(data.redisHitRate) },
            {
              label: "Hits / misses",
              value: formatRate(data.redisHitsPerSecond),
              hint: `${formatRate(data.redisMissesPerSecond)} misses`,
            },
            { label: "Evictions", value: formatRate(data.redisEvictionsPerSecond) },
            { label: "Clients", value: formatNumber(data.redisClients) },
            { label: "Blocked", value: formatNumber(data.redisBlockedClients) },
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Search"
        description="Ranked search, the Mongo fallback, and the embedder and Qdrant probes."
      >
        <StatGrid
          stats={[
            {
              label: "Fallback share",
              value: formatShare(data.fallbackShare),
              hint: "Mongo answers, of every search",
            },
            {
              label: "Ranking drops",
              value: formatNumber(data.rankingEventsDropped),
              hint: "Events lost because the writer buffer was full",
            },
            {
              label: "Vectors",
              value: formatNumber(data.qdrantVectors),
              hint: `${formatNumber(data.qdrantCollections)} collections`,
            },
            {
              label: "Qdrant probe",
              value: qdrant ? (qdrant.up ? "Up" : "Down") : "—",
              hint: qdrant ? formatMs(qdrant.latencyMs) : "No probe",
            },
            {
              label: "Embedder",
              value: embedder ? (embedder.up ? "Up" : "Down") : "—",
              hint: embedder ? formatMs(embedder.latencyMs) : "No probe",
            },
          ]}
        />
        {data.fallbackShare == null ? (
          <Text type="supporting" color="secondary">
            No searches in this range.
          </Text>
        ) : null}
      </SectionCard>
    </Stack>
  );
}

/** Mongo, Redis, Qdrant, and which path answered search. */
export function DataPage() {
  return (
    <MonitorFrame
      title="Data"
      description="The stores behind search and the APIs."
      tab="data"
      ranges={MONITORING_RANGES}
    >
      {(snapshot) => <DataBody data={snapshot.data} services={snapshot.services ?? []} />}
    </MonitorFrame>
  );
}
