import { describe, expect, test } from "bun:test";

import { createTokenBucket, DEFAULT_TOKEN_BUCKET_CAPACITY } from "./tokenBucket.js";

describe("createTokenBucket", () => {
  test("starts with one token so there is no startup burst", async () => {
    let now = 0;
    const sleeps = [];
    const bucket = createTokenBucket({
      rate: 10,
      now: () => now,
      sleep: (ms) => {
        sleeps.push(ms);
        now += ms;
        return Promise.resolve();
      },
    });
    expect(DEFAULT_TOKEN_BUCKET_CAPACITY).toBe(1);
    expect(bucket.capacity).toBe(1);
    expect(bucket.tokens).toBe(1);
    await bucket.take();
    await bucket.take();
    expect(sleeps[0]).toBeGreaterThanOrEqual(100);
    expect(bucket.tokens).toBeGreaterThanOrEqual(0);
  });

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
