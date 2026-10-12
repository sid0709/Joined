/** System monitoring: GET /v1/admin/monitoring/system (backend-core/monitoring). */

/** Chart windows on Overview. The strips ignore this and stay on today plus 90 days. */
export const CHART_RANGES = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
] as const;

export const MONITORING_RANGES = [
  ...CHART_RANGES,
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
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
  component?: string;
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
  uptimeSeconds: Maybe;
  load5: Maybe;
  load15: Maybe;
  loadPerCore: Maybe;
  ioWaitPercent: Maybe;
  stealPercent: Maybe;
  softIrqPercent: Maybe;
  cpuCores: { cpu: string; percent: number }[] | null;
  memoryAvailableBytes: Maybe;
  swapPercent: Maybe;
  inodePercent: Maybe;
  diskReadBytesPerSecond: Maybe;
  diskWriteBytesPerSecond: Maybe;
  networkRxPacketsPerSecond: Maybe;
  networkTxPacketsPerSecond: Maybe;
  networkDropsPerSecond: Maybe;
  networkErrorsPerSecond: Maybe;
  tcpEstablished: Maybe;
  tcpTimeWait: Maybe;
  fileDescriptors: Maybe;
  fileDescriptorMax: Maybe;
  contextSwitchesPerSecond: Maybe;
};

export type Container = {
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  restarts: number;
  group: string;
  hostShare: number;
  oomKills: number;
};

export type MemoryGroup = { name: string; bytes: number; percent: number };

export type ApiTraffic = {
  name: string;
  requestsPerSecond: number;
  p50Ms: Maybe;
  p90Ms: Maybe;
  p95Ms: Maybe;
  p99Ms: Maybe;
  errorRate: number;
  clientErrorRate: number;
  count: number;
};

export type RouteTraffic = {
  api: string;
  route: string;
  method?: string;
  requestsPerSecond: number;
  p50Ms: Maybe;
  p95Ms: Maybe;
  p99Ms: Maybe;
  errorRate: number;
  clientErrorRate: number;
  count: number;
};

export type FailureCount = { status: string; count: number };

export type TrafficSummary = {
  requests: number;
  requestsPerSecond: number;
  successRate: Maybe;
  successDelta: Maybe;
  p50Ms: Maybe;
  p90Ms: Maybe;
  p95Ms: Maybe;
  p99Ms: Maybe;
  clientErrorRate: Maybe;
  errorRate: Maybe;
  unmatchedRate: Maybe;
  failures: FailureCount[] | null;
  slowErrors: number;
};

export type DataServices = {
  mongoConnections: Maybe;
  mongoOpsPerSecond: Maybe;
  redisMemoryBytes: Maybe;
  redisHitRate: Maybe;
  qdrantVectors: Maybe;
  searchesPerSecond: Record<string, number> | null;
  rankingEventsDropped: Maybe;
  fallbackShare: Maybe;
  mongoAvailableConnections: Maybe;
  mongoOpsByType: Record<string, number> | null;
  mongoReplicationLagSeconds: Maybe;
  mongoCacheBytes: Maybe;
  mongoQueuedReaders: Maybe;
  mongoQueuedWriters: Maybe;
  mongoAssertsPerSecond: Maybe;
  redisMaxBytes: Maybe;
  redisEvictionsPerSecond: Maybe;
  redisClients: Maybe;
  redisBlockedClients: Maybe;
  redisHitsPerSecond: Maybe;
  redisMissesPerSecond: Maybe;
  qdrantCollections: Maybe;
};

export type ModelStat = {
  feature: string;
  model: string;
  calls: number;
  successRate: Maybe;
  p50Ms: Maybe;
  p95Ms: Maybe;
  retries: number;
  missingKey: number;
  timeouts: number;
  empty: number;
  promptTokens: number;
  completionTokens: number;
};

export type WorkerStat = {
  name: string;
  lastSuccess: string | null;
  lastDurationSeconds: Maybe;
  lastError: boolean;
  items: number;
};

export type QueueStat = { name: string; count: number };

export type UptimeSlot = { at: string; tone: "up" | "degraded" | "down" | "none"; uptime: Maybe };
export type UptimeDayBar = { date: string; uptime: Maybe; tone: UptimeSlot["tone"] };

export type StatusStrip = {
  id: string;
  name: string;
  todayUptime: Maybe;
  latencyMs?: Maybe;
  up?: boolean;
  today: UptimeSlot[] | null;
  days: UptimeDayBar[] | null;
};

export type ServiceLevel = { name: string; target: string; now: string; met: boolean };

export type MonitorBanner = {
  status: "operational" | "degraded" | "major_outage";
  uptimeSeconds: Maybe;
  loadPerCore: Maybe;
};

export type ChartPoint = { at: string; value: number };
export type NamedSeries = { name: string; points: ChartPoint[] };
export type ChartKey =
  "host" | "traffic" | "latency" | "errors" | "ram" | "disk" | "requests" | "success";

export type SystemSnapshot = {
  range: MonitoringRange;
  at: string;
  banner: MonitorBanner;
  services: ServiceStatus[] | null;
  host: Host;
  containers: Container[] | null;
  memory: MemoryGroup[] | null;
  apis: ApiTraffic[] | null;
  routes: RouteTraffic[] | null;
  methods: RouteTraffic[] | null;
  traffic: TrafficSummary;
  data: DataServices;
  product: {
    models: ModelStat[] | null;
    workers: WorkerStat[] | null;
    queues: QueueStat[] | null;
  };
  strips: StatusStrip[] | null;
  levels: ServiceLevel[] | null;
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
const SHORT_TIME_RANGES: MonitoringRange[] = ["15m", "1h", "6h", "24h"];
const clockFormat = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const monthDayFormat = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const hourFormat = new Intl.DateTimeFormat(LOCALE, { hour: "numeric" });

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

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A duration in seconds, as "6d 18h" or "4h 12m". */
export function formatDuration(seconds: Maybe | undefined) {
  if (seconds == null || seconds < 0) return "—";
  const whole = Math.round(seconds);
  const days = Math.floor(whole / DAY);
  const hours = Math.floor((whole % DAY) / HOUR);
  const minutes = Math.floor((whole % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** One named line, or the first line when name is omitted. */
export function seriesValues(lines: NamedSeries[] | undefined, name?: string) {
  const line = name ? lines?.find((item) => item.name === name) : lines?.[0];
  return line?.points.map((point) => point.value) ?? [];
}

/** Chart axis label: time of day for short ranges, the date for a week. */
export function formatChartTime(at: string, range: MonitoringRange) {
  const date = new Date(at);
  if (SHORT_TIME_RANGES.includes(range)) return clockFormat.format(date);
  // Joined here, not by one formatter: ICU builds differ on the joiner (", " or " at ").
  return `${monthDayFormat.format(date)}, ${hourFormat.format(date)}`;
}
