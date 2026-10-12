"use client";

import {
  GridColumn,
  GridSystem,
  SectionCard,
  Stack,
  StatGrid,
  Table,
  Text,
  type TableColumn,
} from "sid-ui";
import {
  MONITORING_RANGES,
  formatBytes,
  formatNumber,
  formatPercent,
  formatRate,
  type MemoryGroup,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { HostStats } from "./host-stats";
import { ContainersCard } from "./infra-cards";
import { MonitorChart } from "./monitor-chart";
import { MonitorFrame } from "./monitor-frame";
import { ServiceStatusCard } from "./service-status";

const memoryColumns: TableColumn<MemoryGroup>[] = [
  { key: "name", header: "Group", render: (row) => <Text weight="semibold">{row.name}</Text> },
  {
    key: "bytes",
    header: "RAM",
    align: "end",
    render: (row) => formatBytes(row.bytes),
  },
  {
    key: "percent",
    header: "Of VPS",
    align: "end",
    render: (row) => formatPercent(row.percent),
  },
];

function HostBody({
  snapshot,
  range,
}: {
  snapshot: SystemSnapshot;
  range: SystemSnapshot["range"];
}) {
  const { host, charts } = snapshot;
  const cores = host.cpuCores ?? [];
  return (
    <Stack gap={5}>
      <HostStats host={host} />
      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="CPU"
            description="Utilization is the complement of idle. 100% on a core is that core busy."
          >
            <StatGrid
              stats={[
                {
                  label: "Load 1 / 5 / 15",
                  value: `${host.load1?.toFixed(2) ?? "—"}`,
                  hint: `${host.load5?.toFixed(2) ?? "—"} · ${host.load15?.toFixed(2) ?? "—"}`,
                },
                {
                  label: "iowait",
                  value: formatPercent(host.ioWaitPercent),
                  hint: "Waiting on disk",
                },
                {
                  label: "steal",
                  value: formatPercent(host.stealPercent),
                  hint: "Taken by the hypervisor",
                },
                {
                  label: "softirq",
                  value: formatPercent(host.softIrqPercent),
                  hint: "Software interrupts",
                },
              ]}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Pressure"
            description="File descriptors, swap, and how often the kernel switches tasks."
          >
            <StatGrid
              stats={[
                {
                  label: "File descriptors",
                  value: formatNumber(host.fileDescriptors),
                  hint: `of ${formatNumber(host.fileDescriptorMax)}`,
                },
                {
                  label: "Swap",
                  value: formatPercent(host.swapPercent),
                  hint: "Used, when swap exists",
                },
                {
                  label: "Context switches",
                  value: formatRate(host.contextSwitchesPerSecond),
                  hint: "Across every core",
                },
                {
                  label: "Uptime",
                  value:
                    host.uptimeSeconds == null ? "—" : `${Math.round(host.uptimeSeconds / 86400)}d`,
                  hint: "Since boot",
                },
              ]}
            />
          </SectionCard>
        </GridColumn>
      </GridSystem>

      <SectionCard
        title="How host RAM is split"
        description="Each slice is a share of the whole VPS, not of the used band. Available is MemAvailable."
      >
        <Table
          columns={memoryColumns}
          rows={snapshot.memory ?? []}
          rowKey={(row) => row.name}
          variant="plain"
          density="compact"
          empty="No memory breakdown yet."
        />
      </SectionCard>

      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="RAM consumers"
            description="Container working set, summed into groups. Host used is total minus MemAvailable."
            lines={charts?.ram}
            range={range}
            formatValue={formatBytes}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="CPU and memory"
            lines={charts?.host}
            range={range}
            formatValue={formatPercent}
          />
        </GridColumn>
      </GridSystem>

      {cores.length > 0 ? (
        <SectionCard title="Cores" description="Idle complement on each logical CPU, right now.">
          <StatGrid
            stats={cores.map((core) => ({
              label: `CPU ${core.cpu}`,
              value: formatPercent(core.percent),
            }))}
          />
        </SectionCard>
      ) : null}

      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Disk"
            description="Root filesystem. Read and write are bytes per second across every disk."
          >
            <StatGrid
              stats={[
                {
                  label: "Used",
                  value: formatPercent(host.diskPercent),
                  hint: `of ${formatBytes(host.diskTotalBytes)}`,
                },
                {
                  label: "Inodes",
                  value: formatPercent(host.inodePercent),
                  hint: "Root filesystem",
                },
                { label: "Read", value: `${formatBytes(host.diskReadBytesPerSecond)}/s` },
                { label: "Write", value: `${formatBytes(host.diskWriteBytesPerSecond)}/s` },
              ]}
            />
          </SectionCard>
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <SectionCard
            title="Network"
            description="Physical and public interfaces. Loopback, veth, docker, and bridges are left out."
          >
            <StatGrid
              stats={[
                {
                  label: "Throughput",
                  value: `${formatBytes(host.networkRxBytesPerSecond)}/s in`,
                  hint: `${formatBytes(host.networkTxBytesPerSecond)}/s out`,
                },
                {
                  label: "Packets",
                  value: `${formatRate(host.networkRxPacketsPerSecond)} in`,
                  hint: `${formatRate(host.networkTxPacketsPerSecond)} out`,
                },
                {
                  label: "Drops",
                  value: formatRate(host.networkDropsPerSecond),
                  hint: `${formatRate(host.networkErrorsPerSecond)} errors`,
                },
                {
                  label: "TCP",
                  value: formatNumber(host.tcpEstablished),
                  hint: `${formatNumber(host.tcpTimeWait)} time-wait`,
                },
              ]}
            />
          </SectionCard>
        </GridColumn>
      </GridSystem>

      <ContainersCard containers={snapshot.containers ?? []} />
      <ServiceStatusCard services={snapshot.services ?? []} />
    </Stack>
  );
}

/** VPS detail: CPU, memory groups, disk, network, containers, and probes. */
export function HostPage() {
  return (
    <MonitorFrame
      title="Host"
      description="The VPS, in more detail than the overview."
      tab="host"
      ranges={MONITORING_RANGES}
    >
      {(snapshot, range) => <HostBody snapshot={snapshot} range={range} />}
    </MonitorFrame>
  );
}
