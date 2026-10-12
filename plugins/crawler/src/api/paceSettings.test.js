import { describe, expect, test } from "bun:test";

import {
  clampPaceSettings,
  DEFAULT_CONCURRENCY,
  DEFAULT_JOBS_PER_SECOND,
  loadPaceSettings,
  MAX_CONCURRENCY,
  PACE_STORAGE_KEY,
  savePaceSettings,
} from "./paceSettings.js";

describe("clampPaceSettings", () => {
  test("clamps concurrency and jobs/s", () => {
    expect(clampPaceSettings()).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
    });
    expect(clampPaceSettings({ concurrency: 99, jobsPerSecond: 0 })).toEqual({
      concurrency: MAX_CONCURRENCY,
      jobsPerSecond: 1,
    });
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
    });
    expect(await savePaceSettings({ concurrency: 4, jobsPerSecond: 12 }, storage)).toEqual({
      concurrency: 4,
      jobsPerSecond: 12,
    });
    expect(data[PACE_STORAGE_KEY]).toEqual({ concurrency: 4, jobsPerSecond: 12 });
    expect(await loadPaceSettings(storage)).toEqual({ concurrency: 4, jobsPerSecond: 12 });
  });

  test("reads promise-style storage and survives get failures", async () => {
    const storage = {
      get: async (key) => ({ [key]: { concurrency: 2, jobsPerSecond: 5 } }),
      set: async () => {},
    };
    expect(await loadPaceSettings(storage)).toEqual({ concurrency: 2, jobsPerSecond: 5 });
    const failing = {
      get: () => {
        throw new Error("nope");
      },
    };
    expect(await loadPaceSettings(failing)).toEqual({
      concurrency: DEFAULT_CONCURRENCY,
      jobsPerSecond: DEFAULT_JOBS_PER_SECOND,
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
    });
    await expect(savePaceSettings({ concurrency: 2 }, failingChrome)).rejects.toThrow("denied");
    globalThis.chrome = previousChrome;
  });
});
