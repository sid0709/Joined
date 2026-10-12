import { afterEach, expect, test } from "bun:test";

import {
  ADMIN_QUERY_FRESH_MS,
  adminQueryAtPage,
  clearAdminQueryCache,
  forgetAdminQuery,
  pendingAdminQuery,
  prefetchAdminPath,
  readAdminQuery,
  rememberAdminQuery,
  seedAdminQuery,
  trackAdminQuery,
  warmAdminQuery,
} from "./admin-query-cache";

afterEach(() => {
  clearAdminQueryCache();
});

test("a remembered query stays fresh inside the window and stale after it", () => {
  rememberAdminQuery("/jobs?page=1", { total: 1 }, 1_000);
  expect(readAdminQuery("/jobs?page=1", 1_000 + ADMIN_QUERY_FRESH_MS - 1)?.fresh).toBe(true);
  expect(readAdminQuery("/jobs?page=1", 1_000 + ADMIN_QUERY_FRESH_MS)?.fresh).toBe(false);
  expect(readAdminQuery("/missing")).toBeNull();
});

test("seed keeps the first copy and forget drops it", () => {
  seedAdminQuery("/jobs", "first");
  seedAdminQuery("/jobs", "second");
  expect(readAdminQuery<string>("/jobs")?.result).toBe("first");
  forgetAdminQuery("/jobs");
  expect(readAdminQuery("/jobs")).toBeNull();
});

test("the cache drops the oldest path past the limit", () => {
  for (let index = 0; index < 41; index += 1) rememberAdminQuery(`/p/${index}`, index);
  expect(readAdminQuery("/p/0")).toBeNull();
  expect(readAdminQuery<number>("/p/40")?.result).toBe(40);
});

test("one in-flight request is shared, and a forget ignores its late result", async () => {
  let finish: (value: string) => void = () => {};
  const task = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const tracked = trackAdminQuery("/slow", task);
  expect(pendingAdminQuery<string>("/slow")).toBe(tracked);
  forgetAdminQuery("/slow");
  finish("stale");
  await expect(tracked).resolves.toBe("stale");
  expect(readAdminQuery("/slow")).toBeNull();
  expect(pendingAdminQuery("/slow")).toBeUndefined();
});

test("a finished request is remembered, and a failure is not", async () => {
  await expect(trackAdminQuery("/ok", Promise.resolve("ready"))).resolves.toBe("ready");
  expect(readAdminQuery<string>("/ok")?.result).toBe("ready");
  await expect(trackAdminQuery("/bad", Promise.reject(new Error("nope")))).rejects.toThrow("nope");
  expect(readAdminQuery("/bad")).toBeNull();
});

test("warm skips a fresh or in-flight path and loads a cold one once", async () => {
  rememberAdminQuery("/hot", "yes");
  let loads = 0;
  const load = (path: string) => {
    loads += 1;
    return Promise.resolve(path);
  };
  warmAdminQuery("/hot", load);
  warmAdminQuery(null, load);
  const pending = trackAdminQuery("/flight", Promise.resolve("x"));
  warmAdminQuery("/flight", load);
  await pending;
  const cold = warmAdminQuery("/cold", load);
  warmAdminQuery("/cold", load);
  await cold;
  expect(loads).toBe(1);
  expect(readAdminQuery<string>("/cold")?.result).toBe("/cold");
});

test("page helpers move only the page and stop after the last row", () => {
  expect(adminQueryAtPage("/v1/jobs?q=a&page=1&pageSize=25", 3)).toBe(
    "/v1/jobs?q=a&page=3&pageSize=25",
  );
  expect(adminQueryAtPage("/v1/jobs", 2)).toBe("/v1/jobs?page=2");
  expect(prefetchAdminPath("/v1/jobs?page=1", 1, 25)).toBe("/v1/jobs?page=2");
  expect(prefetchAdminPath("/v1/jobs?page=2", 2, 25, 50)).toBeNull();
  expect(prefetchAdminPath("/v1/jobs?page=1", 1, 25, 26)).toBe("/v1/jobs?page=2");
});
