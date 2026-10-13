import { describe, expect, test } from "bun:test";

import { defaultSleepTimers, handleSleep, sleepMs } from "./sleep.js";

describe("service-worker sleep", () => {
  test("resolves immediately for a zero delay", async () => {
    const calls = [];
    await sleepMs(0, { setTimeout: (fn) => calls.push(fn) });
    expect(calls).toEqual([]);
    await expect(handleSleep({ ms: 0 })).resolves.toEqual({ slept: true, ms: 0 });
  });

  test("uses the injected timer so the service worker can keep the wait alive", async () => {
    const calls = [];
    const timers = {
      setTimeout: (fn, ms) => {
        calls.push(ms);
        fn();
        return 1;
      },
    };
    await expect(handleSleep({ ms: 40 }, timers)).resolves.toEqual({ slept: true, ms: 40 });
    expect(calls).toEqual([40]);
  });

  test("exposes the default timer wrapper", async () => {
    const id = defaultSleepTimers.setTimeout(() => {}, 0);
    clearTimeout(id);
    await expect(handleSleep({}, defaultSleepTimers)).resolves.toEqual({ slept: true, ms: 0 });
  });
});
