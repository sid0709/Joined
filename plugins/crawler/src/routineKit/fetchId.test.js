import { describe, expect, test } from "bun:test";

import { abortKeyForFetch, newFetchId } from "./fetchId.js";

describe("fetch abort keys", () => {
  test("newFetchId is unique and is not a URL", () => {
    const first = newFetchId();
    const second = newFetchId();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
    expect(first).not.toContain("http");
  });

  test("abortKeyForFetch uses the request id, never the URL", () => {
    const url = "https://builtin.com/job/x/1";
    expect(abortKeyForFetch("req-1")).toBe("req-1");
    expect(abortKeyForFetch("  req-2  ")).toBe("req-2");
    const generated = abortKeyForFetch("");
    expect(generated).toBeTruthy();
    expect(generated).not.toBe(url);
  });
});
