import { describe, expect, test } from "bun:test";

import { createWorkerPool } from "./workerPool.js";

describe("createWorkerPool", () => {
  test("caps in-flight work and reads a live concurrency limit", async () => {
    let limit = 1;
    const pool = createWorkerPool({ getConcurrency: () => limit });
    let started = 0;
    let release;
    const first = pool.run(async () => {
      started += 1;
      await new Promise((resolve) => {
        release = resolve;
      });
      return "a";
    });
    const second = pool.run(async () => {
      started += 1;
      return "b";
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(started).toBe(1);
    expect(pool.active).toBe(1);
    expect(pool.pending).toBe(1);
    limit = 2;
    release();
    expect(await first).toBe("a");
    expect(await second).toBe("b");
    expect(started).toBe(2);
  });

  test("rejects queued work when the signal aborts", async () => {
    const signal = { aborted: false, addEventListener: () => {} };
    const pool = createWorkerPool({ getConcurrency: 1, signal });
    signal.aborted = true;
    await expect(pool.run(async () => "x")).rejects.toMatchObject({ name: "RoutineStoppedError" });
    const closed = createWorkerPool({ getConcurrency: 1 });
    closed.close();
    await expect(closed.run(async () => "y")).rejects.toMatchObject({
      name: "RoutineStoppedError",
    });
  });
});
