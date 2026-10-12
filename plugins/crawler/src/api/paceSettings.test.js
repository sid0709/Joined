import { describe, expect, test } from "bun:test";

import {
  clampPaceSettings,
  DEFAULT_CONCURRENCY,
  DEFAULT_FAST_MODE,
  DEFAULT_JOBS_PER_SECOND,
  DEFAULT_PACE_SETTINGS,
  loadPaceSettings,
  MAX_CONCURRENCY,
  MAX_JOBS_PER_SECOND,
  PACE_STORAGE_KEY,
  PACE_TIER,
  paceLimits,
  savePaceSettings,
} from "./paceSettings.js";

describe("clampPaceSettings", () => {
  test("defaults to 4 workers / 3 jobs/s with fast mode off", () => {
    expect(PACE_TIER.default).toEqual({ concurrency: 4, jobsPerSecond: 3 });
    expect(PACE_TIER.fast).toEqual({ concurrency: 8, jobsPerSecond: 10 });
    expect(DEFAULT_FAST_MODE).toBe(false);
    expect(clampPaceSettings()).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
      fastMode: false,
    });
    expect(DEFAULT_PACE_SETTINGS).toEqual({
      concurrency: 4,
      jobsPerSecond: 3,
      fastMode: false,
    });
  });

  test("without fast mode, clamps to the default tier", () => {
    expect(clampPaceSettings({ concurrency: 99, jobsPerSecond: 50, fastMode: false })).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
      fastMode: false,
    });
    expect(paceLimits(false)).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
    });
  });

  test("fast mode opts in up to 8 workers / 10 jobs/s", () => {
    expect(clampPaceSettings({ concurrency: 99, jobsPerSecond: 50, fastMode: true })).toEqual({
      concurrency: MAX_CONCURRENCY,
      jobsPerSecond: MAX_JOBS_PER_SECOND,
      fastMode: true,
    });
    expect(clampPaceSettings({ concurrency: 6, jobsPerSecond: 8, fastMode: true })).toEqual({
      concurrency: 6,
      jobsPerSecond: 8,
      fastMode: true,
    });
    expect(paceLimits(true)).toEqual({ concurrency: 8, jobsPerSecond: 10 });
  });
});

describe("pace settings storage", () => {
  test("loads and saves through a chrome-style store", async () => {
    const data = {};
    const storage = {
      get(key, callback) {
        callback({ [key]: data[key] });
      },
      set(items, callback) {
        Object.assign(data, items);
        callback();
      },
    };
    expect(await loadPaceSettings(storage)).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
      fastMode: false,
    });
    expect(
      await savePaceSettings({ concurrency: 6, jobsPerSecond: 8, fastMode: true }, storage),
    ).toEqual({
      concurrency: 6,
      jobsPerSecond: 8,
      fastMode: true,
    });
    expect(data[PACE_STORAGE_KEY]).toEqual({ concurrency: 6, jobsPerSecond: 8, fastMode: true });
    expect(await loadPaceSettings(storage)).toEqual({
      concurrency: 6,
      jobsPerSecond: 8,
      fastMode: true,
    });
  });

  test("reads promise-style storage and survives get failures", async () => {
    const storage = {
      get: async (key) => ({ [key]: { concurrency: 2, jobsPerSecond: 2 } }),
      set: async () => {},
    };
    expect(await loadPaceSettings(storage)).toEqual({
      concurrency: 2,
      jobsPerSecond: 2,
      fastMode: false,
    });
    const failing = {
      get: () => {
        throw new Error("nope");
      },
    };
    expect(await loadPaceSettings(failing)).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
      fastMode: false,
    });
    await savePaceSettings({ concurrency: 3 }, { set: async (items) => items });

    const previousChrome = globalThis.chrome;
    globalThis.chrome = { runtime: { lastError: { message: "denied" } } };
    const failingChrome = {
      get(_key, callback) {
        callback({});
      },
      set(_items, callback) {
        callback();
      },
    };
    expect(await loadPaceSettings(failingChrome)).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
      fastMode: false,
    });
    await expect(savePaceSettings({ concurrency: 2 }, failingChrome)).rejects.toThrow("denied");
    globalThis.chrome = previousChrome;
  });
});
