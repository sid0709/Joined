import { describe, expect, test } from "bun:test";

import { sameTabUrl } from "./navigateTab.js";

describe("sameTabUrl", () => {
  test("ignores a trailing slash and a hash", () => {
    expect(sameTabUrl("https://builtin.com/jobs", "https://builtin.com/jobs/")).toBe(true);
    expect(sameTabUrl("https://builtin.com/jobs?page=2", "https://builtin.com/jobs?page=2#x")).toBe(
      true,
    );
    expect(sameTabUrl("https://builtin.com/jobs", "https://builtin.com/jobs?page=2")).toBe(false);
  });
});
