import { describe, expect, it } from "bun:test";

import { assertSafeOrigin } from "./origins.ts";
import { configFromEnv, executeLoad, reportLoad, runFromEnv, targetUrls } from "./run.ts";
import { percentile, summarize } from "./stats.ts";
import {
  DEFAULT_API_ORIGIN,
  DEFAULT_WEB_ORIGIN,
  LOAD_DURATION_MS,
  LOAD_ERROR_RATE,
  LOAD_P95_MS,
} from "./thresholds.ts";

describe("load stats", () => {
  it("uses nearest-rank p95", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 95)).toBe(100);
    expect(percentile(values, 50)).toBe(50);
  });

  it("rejects an empty sample list", () => {
    expect(() => percentile([], 95)).toThrow("percentile requires samples");
    expect(() => summarize([])).toThrow("load produced no samples");
  });

  it("counts http failures in the error rate", () => {
    const summary = summarize([
      { url: "http://127.0.0.1/a", ok: true, latencyMs: 10, kind: "http", detail: "200" },
      { url: "http://127.0.0.1/b", ok: false, latencyMs: 40, kind: "http", detail: "500" },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.errorRate).toBe(0.5);
    expect(summary.p95Ms).toBe(40);
    expect(summary.networkFailures).toBe(0);
    expect(summary.networkDetail).toBe("");
  });
});

describe("load origins", () => {
  it("allows the local defaults", () => {
    expect(assertSafeOrigin(DEFAULT_API_ORIGIN).hostname).toBe("127.0.0.1");
    expect(assertSafeOrigin(DEFAULT_WEB_ORIGIN).hostname).toBe("localhost");
  });

  it("refuses production hosts before any request", async () => {
    let calls = 0;
    const report = await runFromEnv(
      {
        LOAD_API_ORIGIN: "https://api.joinedhq.com",
        LOAD_WEB_ORIGIN: DEFAULT_WEB_ORIGIN,
        LOAD_JOB_ID: "local-fixture",
      },
      () => {
        calls += 1;
        return Promise.resolve({ ok: true, status: 200 });
      },
    );
    expect(calls).toBe(0);
    expect(report.exitCode).toBe(1);
    expect(report.lines.join("\n")).toContain("refusing production host api.joinedhq.com");
  });

  it("refuses the public site host", () => {
    expect(() => assertSafeOrigin("https://joinedhq.com")).toThrow(
      "refusing production host joinedhq.com",
    );
    expect(() => assertSafeOrigin("https://www.joinedhq.com")).toThrow(
      "refusing production host www.joinedhq.com",
    );
  });
});

describe("load runner", () => {
  it("requires a fixture job id", async () => {
    const report = await runFromEnv({}, () => Promise.resolve({ ok: true, status: 200 }));
    expect(report.exitCode).toBe(1);
    expect(report.lines[0]).toContain("LOAD_JOB_ID is required");
  });

  it("issues read-only GETs and passes under the named thresholds", async () => {
    const seen: string[] = [];
    let clock = 0;
    const report = await runFromEnv(
      { LOAD_JOB_ID: "fixture job" },
      (url, init) => {
        expect(init.method).toBe("GET");
        seen.push(url);
        return Promise.resolve({ ok: true, status: 200 });
      },
      () => {
        clock += 1;
        return clock;
      },
    );
    expect(report.exitCode).toBe(0);
    expect(report.lines.at(-1)).toBe("pass");
    expect(seen.some((url) => url === "http://127.0.0.1:8080/v1/search/jobs")).toBe(true);
    expect(seen.some((url) => url === "http://localhost:6002/jobs/fixture%20job")).toBe(true);
    expect(report.summary?.p95Ms).toBeLessThanOrEqual(LOAD_P95_MS);
    expect(report.summary?.errorRate).toBeLessThanOrEqual(LOAD_ERROR_RATE);
  });

  it("exits non-zero when every request fails to connect", async () => {
    let clock = 0;
    const report = await runFromEnv(
      { LOAD_JOB_ID: "fixture" },
      () => {
        clock += LOAD_DURATION_MS;
        return Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:8080"));
      },
      () => clock,
    );
    expect(report.exitCode).toBe(1);
    expect(report.lines.join("\n")).toContain("unreachable");
    expect(report.lines.join("\n")).toContain("ECONNREFUSED");
  });

  it("exits non-zero when p95 is over the threshold", async () => {
    const config = configFromEnv({ LOAD_JOB_ID: "fixture" });
    let clock = 0;
    const summary = await executeLoad({
      ...config,
      durationMs: 0,
      fetchImpl: (url) => {
        clock += url.includes("/jobs/") ? 5_000 : 10;
        return Promise.resolve({ ok: true, status: 200 });
      },
      now: () => clock,
    });
    const report = reportLoad(summary, config);
    expect(report.exitCode).toBe(1);
    expect(report.lines.join("\n")).toContain("fail:");
    expect(targetUrls(config)).toEqual([
      "http://127.0.0.1:8080/v1/search/jobs",
      "http://localhost:6002/jobs/fixture",
    ]);
  });
});
