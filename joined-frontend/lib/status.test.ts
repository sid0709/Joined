import { describe, expect, it } from "bun:test";
import { formatDay, formatTime, formatUptime, uptimeDays, type StatusComponent } from "./status";

describe("formatUptime", () => {
  it("rounds down, so 99.999% never reads as 100%", () => {
    expect(formatUptime(1)).toBe("100%");
    expect(formatUptime(0.99999)).toBe("99.99%");
    expect(formatUptime(0.95)).toBe("95.00%");
    expect(formatUptime(null)).toBe("No data yet");
  });
});

describe("dates", () => {
  it("reads days and times in UTC", () => {
    expect(formatDay("2026-10-11")).toBe("Oct 11, 2026");
    expect(formatTime("2026-10-11T15:04:00Z")).toBe("Oct 11 at 3:04 PM UTC");
  });
});

describe("uptimeDays", () => {
  it("puts uptime and incidents in each day's tip", () => {
    const component: StatusComponent = {
      id: "api",
      name: "API",
      description: "",
      status: "operational",
      uptime: 0.99,
      days: [
        { date: "2026-10-10", uptime: null, tone: "none" },
        { date: "2026-10-11", uptime: 0.98, tone: "down", incidents: ["Slow sign-in"] },
      ],
    };
    expect(uptimeDays(component)).toEqual([
      { label: "Oct 10, 2026", tone: "none", details: [] },
      { label: "Oct 11, 2026", tone: "down", details: ["98.00% uptime", "Slow sign-in"] },
    ]);
  });
});
