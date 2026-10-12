"use client";

import {
  Badge,
  GridColumn,
  GridSystem,
  HStack,
  KpiWidget,
  SectionCard,
  Sparkline,
  Stack,
  Text,
  type KpiDelta,
} from "sid-ui";
import {
  CHART_RANGES,
  formatBytes,
  formatDuration,
  formatMs,
  formatNumber,
  formatPercent,
  formatRate,
  formatShare,
  seriesValues,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { ServiceLevels } from "./levels";
import { MonitorFrame } from "./monitor-frame";
import { AvailabilityStrips } from "./strips";

const BANNER: Record<
  SystemSnapshot["banner"]["status"],
  { label: string; variant: "success" | "warning" | "error" }
> = {
  operational: { label: "All systems operational", variant: "success" },
  degraded: { label: "Degraded", variant: "warning" },
  major_outage: { label: "Outage", variant: "error" },
};

function memoryHint(host: SystemSnapshot["host"]) {
  const total = host.memoryTotalBytes;
  const available = host.memoryAvailableBytes;
  if (total == null || available == null) return "Whole VPS used, from MemAvailable";
  return `${formatBytes(total - available)} of ${formatBytes(total)}`;
}

function pointsDelta(delta: number | null | undefined): KpiDelta | undefined {
  if (delta == null) return undefined;
  const points = delta * 100;
  const direction = points > 0.05 ? "up" : points < -0.05 ? "down" : "flat";
  const sign = points > 0 ? "+" : "";
  return { value: `${sign}${points.toFixed(1)} pts`, direction };
}

function OverviewBody({ snapshot }: { snapshot: SystemSnapshot }) {
  const { charts, traffic, host, banner } = snapshot;
  const bannerTone = BANNER[banner.status];
  const strips = snapshot.strips ?? [];
  const hostStrip = strips.filter((strip) => strip.id === "host");
  const services = strips.filter((strip) => strip.id !== "host");
  return (
    <Stack gap={5}>
      <SectionCard title="Infrastructure health" description="Checks every 30 seconds.">
        <HStack gap={4} wrap="wrap" vAlign="center">
          <Badge label={bannerTone.label} variant={bannerTone.variant} />
          <Text type="supporting" color="secondary">
            Uptime {formatDuration(banner.uptimeSeconds)}
          </Text>
          <Text type="supporting" color="secondary">
            Load per core {banner.loadPerCore == null ? "—" : banner.loadPerCore.toFixed(2)}
          </Text>
        </HStack>
      </SectionCard>

      <GridSystem gap={4}>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="Requests"
            value={formatRate(traffic.requestsPerSecond)}
            hint={`${formatNumber(traffic.requests)} in this range · 5xx ${formatShare(traffic.errorRate)}`}
          >
            <Sparkline values={seriesValues(charts?.requests)} label="Requests per second" />
          </KpiWidget>
        </GridColumn>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="Success rate"
            value={formatShare(traffic.successRate)}
            delta={pointsDelta(traffic.successDelta)}
            hint="Non-5xx, compared with the previous window"
          >
            <Sparkline values={seriesValues(charts?.success)} label="Success rate" tone="green" />
          </KpiWidget>
        </GridColumn>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="p95 latency"
            value={formatMs(traffic.p95Ms)}
            hint={`p50 ${formatMs(traffic.p50Ms)} · p99 ${formatMs(traffic.p99Ms)}`}
          >
            <Sparkline
              values={seriesValues(charts?.latency, "p95")}
              label="p95 latency"
              tone="orange"
            />
          </KpiWidget>
        </GridColumn>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="CPU"
            value={formatPercent(host.cpuPercent)}
            hint={`Load ${host.load1?.toFixed(2) ?? "—"} on ${host.cores ?? "—"} cores`}
          >
            <Sparkline values={seriesValues(charts?.host, "CPU %")} label="CPU" />
          </KpiWidget>
        </GridColumn>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="Host memory"
            value={formatPercent(host.memoryPercent)}
            hint={memoryHint(host)}
          >
            <Sparkline
              values={seriesValues(charts?.host, "Memory %")}
              label="Host memory"
              tone="purple"
            />
          </KpiWidget>
        </GridColumn>
        <GridColumn span="full" md={6} lg={4}>
          <KpiWidget
            label="Disk"
            value={formatPercent(host.diskPercent)}
            hint={
              host.diskFullDays == null
                ? "Not filling at the last 6 hours' pace"
                : `Full in about ${Math.round(host.diskFullDays)} days`
            }
          >
            <Sparkline values={seriesValues(charts?.disk)} label="Disk" tone="orange" />
          </KpiWidget>
        </GridColumn>
      </GridSystem>

      <AvailabilityStrips
        strips={hostStrip}
        title="VPS availability"
        description="Today in 15-minute intervals, then one UTC day each for 90 days. A bar goes amber when CPU, memory, or disk crosses 80%, and red when probes fail."
      />
      <AvailabilityStrips
        strips={services}
        title="Services"
        description="Public components, then internal probes that are not on the status page. Today is 15-minute bars. The daily strip is recorded so it outlives Prometheus."
      />
      <ServiceLevels levels={snapshot.levels ?? []} />
    </Stack>
  );
}

/** Overview: live status, six cards, uptime strips, and service levels. */
export function OverviewPage() {
  return (
    <MonitorFrame
      title="Overview"
      description="VPS, probes, and API health."
      tab="overview"
      ranges={CHART_RANGES}
    >
      {(snapshot) => <OverviewBody snapshot={snapshot} />}
    </MonitorFrame>
  );
}
