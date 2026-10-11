import { Badge, StatGrid } from "sid-ui";
import {
  DISK_FULL_WARN_DAYS,
  HOST_WARN_PERCENT,
  formatBytes,
  formatPercent,
  type Host,
} from "@/lib/monitoring";

function level(percent: number | null) {
  if (percent == null) return undefined;
  return percent >= HOST_WARN_PERCENT ? <Badge label="High" variant="warning" /> : undefined;
}

function diskHint(host: Host) {
  const total = `of ${formatBytes(host.diskTotalBytes)}`;
  if (host.diskFullDays == null) return `${total} · not filling`;
  return `${total} · full in ~${Math.round(host.diskFullDays)} days`;
}

/** The VPS right now: CPU, memory, disk, and network. */
export function HostStats({ host }: { host: Host }) {
  const diskSoon = host.diskFullDays != null && host.diskFullDays < DISK_FULL_WARN_DAYS;
  return (
    <StatGrid
      stats={[
        {
          label: "CPU",
          value: formatPercent(host.cpuPercent),
          hint: `Load ${host.load1?.toFixed(2) ?? "—"} on ${host.cores ?? "—"} cores`,
          accessory: level(host.cpuPercent),
        },
        {
          label: "Memory",
          value: formatPercent(host.memoryPercent),
          hint: `of ${formatBytes(host.memoryTotalBytes)}`,
          accessory: level(host.memoryPercent),
        },
        {
          label: "Disk",
          value: formatPercent(host.diskPercent),
          hint: diskHint(host),
          accessory: diskSoon ? (
            <Badge label="Filling" variant="warning" />
          ) : (
            level(host.diskPercent)
          ),
        },
        {
          label: "Network",
          value: `${formatBytes(host.networkRxBytesPerSecond)}/s in`,
          hint: `${formatBytes(host.networkTxBytesPerSecond)}/s out`,
        },
      ]}
    />
  );
}
