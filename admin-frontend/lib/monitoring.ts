/** System monitoring: GET /v1/admin/monitoring/system (backend-core/monitoring). */

export const MONITORING_RANGES = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
] as const;
export type MonitoringRange = (typeof MONITORING_RANGES)[number]["value"];
export const DEFAULT_MONITORING_RANGE: MonitoringRange = "24h";

/** How often the system page refetches while open. */
export const SYSTEM_REFRESH_MS = 30_000;

/** Above these, a host gauge turns from fine to worrying. */
export const HOST_WARN_PERCENT = 80;
/** Fewer days than this until the disk fills is worth a look. */
export const DISK_FULL_WARN_DAYS = 14;

export type ServiceStatus = {
  name: string;
  target: string;
  kind: "probe" | "scrape";
  up: boolean;
  uptime: number;
  latencyMs?: number;
};

type Maybe = number | null;

export type Host = {
  cpuPercent: Maybe;
  cores: Maybe;
  load1: Maybe;
  memoryPercent: Maybe;
  memoryTotalBytes: Maybe;
  diskPercent: Maybe;
  diskTotalBytes: Maybe;
  diskFullDays: Maybe;
  networkRxBytesPerSecond: Maybe;
  networkTxBytesPerSecond: Maybe;
};

export type Container = {
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  restarts: number;
};

export type ApiTraffic = {
  name: string;
  requestsPerSecond: number;
  p50Ms: Maybe;
  p95Ms: Maybe;
  p99Ms: Maybe;
  errorRate: number;
};

export type RouteTraffic = {
  api: string;
  route: string;
  requestsPerSecond: number;
  p95Ms: Maybe;
  errorRate: number;
};

export type DataServices = {
  mongoConnections: Maybe;
  mongoOpsPerSecond: Maybe;
  redisMemoryBytes: Maybe;
  redisHitRate: Maybe;
  qdrantVectors: Maybe;
  searchesPerSecond: Record<string, number> | null;
  rankingEventsDropped: Maybe;
};

export type ChartPoint = { at: string; value: number };
export type NamedSeries = { name: string; points: ChartPoint[] };
export type ChartKey = "host" | "traffic" | "latency" | "errors";

export type SystemSnapshot = {
  range: MonitoringRange;
  at: string;
  services: ServiceStatus[] | null;
  host: Host;
  containers: Container[] | null;
  apis: ApiTraffic[] | null;
  routes: RouteTraffic[] | null;
  data: DataServices;
  charts: Partial<Record<ChartKey, NamedSeries[]>> | null;
};

export function parseMonitoringRange(value: string | null | undefined): MonitoringRange {
  return (
    MONITORING_RANGES.find((range) => range.value === value)?.value ?? DEFAULT_MONITORING_RANGE
  );
}

export function systemPath(range: MonitoringRange) {
  return `/v1/admin/monitoring/system?range=${range}`;
}

/** One chart's lines on a shared time axis: TrendChart wants a value per label. */
export function alignSeries(lines: NamedSeries[] = []) {
  const times = [...new Set(lines.flatMap((line) => line.points.map((point) => point.at)))].sort();
  const series = lines.map((line) => {
    const byTime = new Map(line.points.map((point) => [point.at, point.value]));
    return { label: line.name, values: times.map((at) => byTime.get(at) ?? 0) };
  });
  return { times, series };
}

const LOCALE = "en";
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];
const BYTE_STEP = 1024;
const PERCENT = 100;
const MS_PER_SECOND = 1000;
const SHORT_TIME_RANGES: MonitoringRange[] = ["1h", "24h"];

export function formatBytes(value: Maybe | undefined) {
  if (value == null) return "—";
  let size = value;
  let unit = 0;
  while (size >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    size /= BYTE_STEP;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

/** A 0–100 value. */
export function formatPercent(value: Maybe | undefined) {
  return value == null ? "—" : `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

/** A 0–1 share, e.g. uptime or an error rate. */
export function formatShare(value: Maybe | undefined) {
  if (value == null) return "—";
  const percent = value * PERCENT;
  if (percent === 0 || percent === PERCENT) return `${percent}%`;
  return `${percent.toFixed(percent >= 99 || percent < 1 ? 2 : 1)}%`;
}

export function formatMs(value: Maybe | undefined) {
  if (value == null) return "—";
  return value >= MS_PER_SECOND
    ? `${(value / MS_PER_SECOND).toFixed(1)} s`
    : `${Math.round(value)} ms`;
}

export function formatRate(value: Maybe | undefined, unit = "/s") {
  if (value == null) return "—";
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: value >= 10 ? 0 : 2 })}${unit}`;
}

export function formatNumber(value: Maybe | undefined) {
  return value == null ? "—" : Math.round(value).toLocaleString(LOCALE);
}

/** Chart axis label: time of day for short ranges, the date for a week. */
export function formatChartTime(at: string, range: MonitoringRange) {
  const date = new Date(at);
  return new Intl.DateTimeFormat(
    LOCALE,
    SHORT_TIME_RANGES.includes(range)
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric" },
  ).format(date);
}
