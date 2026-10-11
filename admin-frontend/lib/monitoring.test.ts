import { describe, expect, it } from "bun:test";
import {
  alignSeries,
  formatBytes,
  formatChartTime,
  formatMs,
  formatNumber,
  formatPercent,
  formatRate,
  formatShare,
  parseMonitoringRange,
  systemPath,
} from "./monitoring";

describe("alignSeries", () => {
  it("puts every line on one time axis, filling gaps with zero", () => {
    const { times, series } = alignSeries([
      { name: "joined-backend", points: [{ at: "2026-01-01T00:00:00Z", value: 3 }] },
      {
        name: "admin-backend",
        points: [
          { at: "2026-01-01T00:00:00Z", value: 1 },
          { at: "2026-01-01T00:30:00Z", value: 2 },
        ],
      },
    ]);
    expect(times).toEqual(["2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z"]);
    expect(series).toEqual([
      { label: "joined-backend", values: [3, 0] },
      { label: "admin-backend", values: [1, 2] },
    ]);
  });

  it("handles a chart with no data", () => {
    expect(alignSeries(undefined)).toEqual({ times: [], series: [] });
  });
});

describe("formatters", () => {
  it("formats bytes, shares, and latency", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
    expect(formatBytes(null)).toBe("—");
    expect(formatShare(1)).toBe("100%");
    expect(formatShare(0.9995)).toBe("99.95%");
    expect(formatShare(0.004)).toBe("0.40%");
    expect(formatMs(42.4)).toBe("42 ms");
    expect(formatMs(2300)).toBe("2.3 s");
  });

  it("formats percents, rates, counts, and chart times", () => {
    expect(formatPercent(42.4)).toBe("42%");
    expect(formatPercent(3.25)).toBe("3.3%");
    expect(formatPercent(null)).toBe("—");
    expect(formatRate(1234.5)).toBe("1,235/s");
    expect(formatRate(0.123, " ops/s")).toBe("0.12 ops/s");
    expect(formatNumber(1234.6)).toBe("1,235");
    expect(formatNumber(undefined)).toBe("—");
    const at = new Date(2026, 9, 11, 15, 30).toISOString();
    expect(formatChartTime(at, "1h")).toBe("3:30 PM");
    expect(formatChartTime(at, "7d")).toBe("Oct 11, 3 PM");
  });
});

describe("range", () => {
  it("falls back to the last 24 hours", () => {
    expect(parseMonitoringRange("1y")).toBe("24h");
    expect(systemPath(parseMonitoringRange("7d"))).toBe("/v1/admin/monitoring/system?range=7d");
  });
});
