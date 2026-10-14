import { describe, expect, test } from "bun:test";

import { resolveAsyncStatus } from "./async-state";

describe("resolveAsyncStatus", () => {
  test("loading wins so an old error or empty list never shows mid-request", () => {
    expect(resolveAsyncStatus({ isLoading: true, error: "x", isEmpty: true })).toBe("loading");
  });

  test("an error beats empty, so a failed request is not read as no results", () => {
    expect(resolveAsyncStatus({ isLoading: false, error: "x", isEmpty: true })).toBe("error");
  });

  test("empty and ready are told apart by the data", () => {
    expect(resolveAsyncStatus({ isLoading: false, isEmpty: true })).toBe("empty");
    expect(resolveAsyncStatus({ isLoading: false, error: null, isEmpty: false })).toBe("ready");
  });
});
