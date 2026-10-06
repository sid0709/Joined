export type SampleKind = "http" | "network";

export type Sample = {
  url: string;
  ok: boolean;
  latencyMs: number;
  kind: SampleKind;
  detail: string;
};

export type Summary = {
  count: number;
  errors: number;
  errorRate: number;
  p95Ms: number;
  networkFailures: number;
  networkDetail: string;
};

/** Nearest-rank percentile. `values` must be sorted ascending and non-empty. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    throw new Error("percentile requires samples");
  }
  if (p <= 0) {
    return values[0] ?? 0;
  }
  if (p >= 100) {
    return values[values.length - 1] ?? 0;
  }
  const rank = Math.ceil((p / 100) * values.length) - 1;
  const index = Math.min(Math.max(rank, 0), values.length - 1);
  return values[index] ?? 0;
}

export function summarize(samples: readonly Sample[]): Summary {
  if (samples.length === 0) {
    throw new Error("load produced no samples");
  }
  const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  const errors = samples.filter((sample) => !sample.ok).length;
  const network = samples.filter((sample) => sample.kind === "network");
  return {
    count: samples.length,
    errors,
    errorRate: errors / samples.length,
    p95Ms: percentile(latencies, 95),
    networkFailures: network.length,
    networkDetail: network[0]?.detail ?? "",
  };
}

export function withinThresholds(
  summary: Summary,
  limits: { p95Ms: number; errorRate: number },
): boolean {
  return summary.p95Ms <= limits.p95Ms && summary.errorRate <= limits.errorRate;
}
