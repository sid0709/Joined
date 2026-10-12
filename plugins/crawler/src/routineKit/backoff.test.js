import { describe, expect, test } from "bun:test";

import {
  backoffWaitMs,
  createAdaptiveBackoff,
  detectFetchBlock,
  detectPageBlock,
  isTransientBlock,
  MAX_RETRY_AFTER_MS,
  parseRetryAfter,
} from "./backoff.js";

describe("parseRetryAfter", () => {
  test("reads delta-seconds, HTTP dates, and ignores junk", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("nope")).toBeNull();
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:03 GMT", () => now)).toBe(3000);
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:00 GMT", now)).toBe(0);
  });

  test("clamps Retry-After to 10 minutes", () => {
    expect(parseRetryAfter("7200")).toBe(MAX_RETRY_AFTER_MS);
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(parseRetryAfter("Thu, 01 Jan 2026 01:00:00 GMT", () => now)).toBe(MAX_RETRY_AFTER_MS);
    expect(parseRetryAfter("5")).toBe(5000);
  });
});

describe("backoffWaitMs", () => {
  test("grows exponentially with jitter up to ~60s", () => {
    expect(backoffWaitMs(1, { baseMs: 2_000, maxMs: 60_000, random: () => 1 })).toBe(2_000);
    expect(backoffWaitMs(2, { baseMs: 2_000, maxMs: 60_000, random: () => 1 })).toBe(4_000);
    expect(backoffWaitMs(6, { baseMs: 2_000, maxMs: 60_000, random: () => 1 })).toBe(60_000);
    expect(backoffWaitMs(1, { baseMs: 2_000, maxMs: 60_000, random: () => 0 })).toBe(1_000);
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

describe("detectPageBlock", () => {
  test("flags a login wall from the tab URL, not a job page apply link", () => {
    expect(detectPageBlock({ status: 200, url: "https://builtin.com/auth/login" }).kind).toBe(
      "login",
    );
    expect(
      detectPageBlock({
        status: 200,
        url: "https://builtin.com/job/eng-quality/11621046",
        html: '<a href="/auth/login">Log In to apply</a>',
      }).blocked,
    ).toBe(false);
    expect(detectPageBlock({ status: 429, url: "https://builtin.com/jobs" }).kind).toBe("429");
    expect(detectPageBlock({ status: 404, url: "https://builtin.com/jobs" }).kind).toBe("dead");
    expect(detectPageBlock({ status: 410, url: "https://builtin.com/job/x/1" }).kind).toBe("dead");
    expect(isTransientBlock("403")).toBe(true);
    expect(isTransientBlock("429")).toBe(true);
    expect(isTransientBlock("challenge")).toBe(true);
    expect(isTransientBlock("login")).toBe(false);
    expect(isTransientBlock("dead")).toBe(false);
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
      random: () => 1,
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
    expect(second.waitMs).toBe(4000);
    expect(backoff.blockCount).toBe(2);
    expect(backoff.blocks).toHaveLength(2);
    backoff.onSuccess();
    backoff.onSuccess();
    expect(backoff.concurrency).toBe(3);
  });

  test("clamps a huge Retry-After and uses exponential jitter otherwise", async () => {
    const sleeps = [];
    const backoff = createAdaptiveBackoff({
      maxConcurrency: 4,
      maxBlocks: 5,
      pauseMs: 2_000,
      maxPauseMs: 60_000,
      random: () => 1,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    await backoff.onBlock({ retryAfter: "7200", kind: "429" });
    expect(sleeps[0]).toBe(MAX_RETRY_AFTER_MS);
    await backoff.onBlock({ kind: "403" });
    expect(sleeps[1]).toBe(4000);
  });
});
