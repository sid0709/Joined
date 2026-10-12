import { describe, expect, test } from "bun:test";

import { createAdaptiveBackoff, detectFetchBlock, parseRetryAfter } from "./backoff.js";

describe("parseRetryAfter", () => {
  test("reads delta-seconds, HTTP dates, and ignores junk", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("nope")).toBeNull();
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:03 GMT", () => now)).toBe(3000);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:00 GMT", now)).toBe(0);
  });
});

describe("detectFetchBlock", () => {
  test("flags 429, 403, Retry-After, and challenge pages", () => {
    expect(detectFetchBlock({ status: 429 }).kind).toBe("429");
    expect(detectFetchBlock({ status: 403 }).kind).toBe("403");
    expect(detectFetchBlock({ status: 200, retryAfter: "5" }).kind).toBe("retry-after");
    expect(detectFetchBlock({ status: 200, html: "pardon our interruption" }).kind).toBe(
      "challenge",
    );
    expect(detectFetchBlock({ status: 200, html: "ok" }).blocked).toBe(false);
  });
});

describe("createAdaptiveBackoff", () => {
  test("halves concurrency, honours Retry-After, ramps, and stops after N blocks", async () => {
    let now = 0;
    const sleeps = [];
    const backoff = createAdaptiveBackoff({
      maxConcurrency: 8,
      minConcurrency: 1,
      maxBlocks: 2,
      windowMs: 60_000,
      pauseMs: 2_000,
      rampEvery: 2,
      now: () => now,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    expect(backoff.concurrency).toBe(8);
    const first = await backoff.onBlock({ retryAfter: "1", kind: "429" });
    expect(first.concurrency).toBe(4);
    expect(first.stop).toBe(false);
    expect(sleeps).toEqual([1000]);
    now += 10;
    const second = await backoff.onBlock({ kind: "403" });
    expect(second.stop).toBe(true);
    expect(backoff.blockCount).toBe(2);
    expect(backoff.blocks).toHaveLength(2);
    backoff.onSuccess();
    backoff.onSuccess();
    expect(backoff.concurrency).toBe(3);
  });
});
