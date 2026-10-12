import { describe, expect, test } from "bun:test";

import { isApplyRedirect, resolveApplyUrl } from "./applyUrl.js";

const PAGE = "https://builtin.com/job/staff-engineer/9256204";

describe("resolveApplyUrl", () => {
  test("keeps an absolute http(s) URL and does not follow it", () => {
    expect(resolveApplyUrl("https://careers.example/apply/1", PAGE)).toBe(
      "https://careers.example/apply/1",
    );
    expect(resolveApplyUrl("", PAGE)).toBe("");
  });

  test("resolves a relative ApplyRedirect path against the Built In job URL", () => {
    const resolved = resolveApplyUrl("?handler=ApplyRedirect", PAGE);
    expect(resolved).toBe(`${PAGE}?handler=ApplyRedirect`);
    expect(isApplyRedirect(resolved)).toBe(true);
    expect(isApplyRedirect("https://careers.example/apply/1")).toBe(false);
  });
});
