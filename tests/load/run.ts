import { assertSafeOrigin } from "./origins.ts";
import { summarize, withinThresholds, type Sample, type Summary } from "./stats.ts";
import {
  DEFAULT_API_ORIGIN,
  DEFAULT_WEB_ORIGIN,
  JOB_PATH_PREFIX,
  LOAD_DURATION_MS,
  LOAD_ERROR_RATE,
  LOAD_MAX_WAVES,
  LOAD_P95_MS,
  LOAD_VUS,
  SEARCH_PATH,
} from "./thresholds.ts";

export type LoadConfig = {
  apiOrigin: string;
  webOrigin: string;
  jobId: string;
  vus: number;
  durationMs: number;
  p95Ms: number;
  errorRate: number;
};

export type LoadEnv = {
  LOAD_API_ORIGIN?: string;
  LOAD_WEB_ORIGIN?: string;
  LOAD_JOB_ID?: string;
};

export function configFromEnv(env: LoadEnv): LoadConfig {
  const apiOrigin = env.LOAD_API_ORIGIN?.trim() || DEFAULT_API_ORIGIN;
  const webOrigin = env.LOAD_WEB_ORIGIN?.trim() || DEFAULT_WEB_ORIGIN;
  const jobId = env.LOAD_JOB_ID?.trim() ?? "";
  if (jobId === "") {
    throw new Error(
      "LOAD_JOB_ID is required. Pass a local fixture id. Do not use a production slug.",
    );
  }
  assertSafeOrigin(apiOrigin);
  assertSafeOrigin(webOrigin);
  return {
    apiOrigin,
    webOrigin,
    jobId,
    vus: LOAD_VUS,
    durationMs: LOAD_DURATION_MS,
    p95Ms: LOAD_P95_MS,
    errorRate: LOAD_ERROR_RATE,
  };
}

export function targetUrls(
  config: Pick<LoadConfig, "apiOrigin" | "webOrigin" | "jobId">,
): string[] {
  const search = new URL(SEARCH_PATH, config.apiOrigin);
  const job = new URL(`${JOB_PATH_PREFIX}${encodeURIComponent(config.jobId)}`, config.webOrigin);
  return [search.toString(), job.toString()];
}

export type FetchLike = (
  url: string,
  init: { method: "GET" },
) => Promise<{ ok: boolean; status: number }>;

export type LoadInput = LoadConfig & {
  fetchImpl: FetchLike;
  now: () => number;
};

export async function executeLoad(input: LoadInput): Promise<Summary> {
  const urls = targetUrls(input);
  const samples: Sample[] = [];
  const deadline = input.now() + input.durationMs;
  let waves = 0;
  do {
    const waveStarted = input.now();
    waves += 1;
    if (waves > LOAD_MAX_WAVES) {
      throw new Error("load clock did not advance");
    }
    const wave = await Promise.all(
      Array.from({ length: input.vus }, () => sampleTargets(urls, input.fetchImpl, input.now)),
    );
    for (const batch of wave) {
      samples.push(...batch);
    }
    if (samples.every((sample) => sample.kind === "network")) {
      break;
    }
    if (input.now() <= waveStarted && input.now() < deadline) {
      throw new Error("load clock did not advance");
    }
  } while (input.now() < deadline);
  return summarize(samples);
}

async function sampleTargets(
  urls: readonly string[],
  fetchImpl: FetchLike,
  now: () => number,
): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (const url of urls) {
    const started = now();
    try {
      const response = await fetchImpl(url, { method: "GET" });
      samples.push({
        url,
        ok: response.ok,
        latencyMs: Math.max(0, now() - started),
        kind: "http",
        detail: String(response.status),
      });
    } catch (err) {
      samples.push({
        url,
        ok: false,
        latencyMs: Math.max(0, now() - started),
        kind: "network",
        detail: err instanceof Error ? err.message : "request failed",
      });
    }
  }
  return samples;
}

export type LoadReport = {
  exitCode: number;
  lines: string[];
  summary?: Summary;
};

export function reportLoad(summary: Summary, config: LoadConfig): LoadReport {
  const lines = [
    `samples=${summary.count}`,
    `errors=${summary.errors}`,
    `error_rate=${summary.errorRate.toFixed(4)}`,
    `p95_ms=${summary.p95Ms}`,
    `network_failures=${summary.networkFailures}`,
    `thresholds p95_ms<=${config.p95Ms} error_rate<=${config.errorRate} vus=${config.vus} duration_ms=${config.durationMs}`,
  ];
  if (summary.networkFailures === summary.count) {
    lines.push(
      `unreachable: every request failed before an HTTP status (${summary.networkDetail}). Check LOAD_API_ORIGIN and LOAD_WEB_ORIGIN.`,
    );
    return { exitCode: 1, lines, summary };
  }
  if (!withinThresholds(summary, config)) {
    lines.push("fail: p95 or error rate is over the named threshold");
    return { exitCode: 1, lines, summary };
  }
  lines.push("pass");
  return { exitCode: 0, lines, summary };
}

export async function runFromEnv(
  env: LoadEnv,
  fetchImpl: FetchLike,
  now: () => number = Date.now,
): Promise<LoadReport> {
  try {
    const config = configFromEnv(env);
    const summary = await executeLoad({ ...config, fetchImpl, now });
    return reportLoad(summary, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : "load failed";
    return { exitCode: 1, lines: [message] };
  }
}
