import { describe, expect, test } from "bun:test";

import { createTokenBucket } from "./tokenBucket.js";

describe("createTokenBucket", () => {
  test("waits until tokens refill at the configured jobs/s", async () => {
    let now = 0;
    const sleeps = [];
    const bucket = createTokenBucket({
      rate: 10,
      capacity: 1,
      now: () => now,
      sleep: (ms) => {
        sleeps.push(ms);
        now += ms;
        return Promise.resolve();
      },
    });
    expect(bucket.rate).toBe(10);
    await bucket.take();
    await bucket.take();
    expect(sleeps[0]).toBeGreaterThanOrEqual(100);
    expect(bucket.tokens).toBeGreaterThanOrEqual(0);
  });

  test("skips waiting when the rate is infinite", async () => {
    const sleeps = [];
    const bucket = createTokenBucket({
      rate: Infinity,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    await bucket.take(3);
    expect(sleeps).toEqual([]);
    expect(bucket.rate).toBe(Infinity);
    expect(bucket.tokens).toBe(1);
  });
});
