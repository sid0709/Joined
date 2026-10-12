import { describe, expect, test } from "bun:test";

import { createPaceMeter } from "./paceMeter.js";

describe("createPaceMeter", () => {
  test("reports jobs/s over the rolling window", () => {
    let now = 1_000;
    const meter = createPaceMeter({ windowMs: 1_000, now: () => now });
    expect(meter.jobsPerSecond()).toBe(0);
    meter.mark();
    now += 250;
    meter.mark();
    now += 250;
    meter.mark();
    expect(meter.count).toBe(3);
    expect(meter.jobsPerSecond()).toBeGreaterThan(0);
    now += 2_000;
    expect(meter.jobsPerSecond()).toBe(0);
    expect(meter.count).toBe(0);
  });
});
