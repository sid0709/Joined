import { describe, expect, test } from "bun:test";

import { jobCardSelector, jobLinkPath, jobPathFromHref } from "./constants.js";
import { cssEscape } from "./cssEscape.js";

describe("HiringCafe cssEscape", () => {
  test("escapes the requisition id in the exact job-path selector", () => {
    const job = {
      id: "reqaaa1111111111",
      url: "https://hiringcafe.com/job/help-desk-coordinator-reqaaa1111111111",
    };
    expect(jobLinkPath(job)).toBe("/job/help-desk-coordinator-reqaaa1111111111");
    expect(
      jobLinkPath({ url: "https://hiringcafe.com/job/help-desk-coordinator-reqaaa1111111111" }),
    ).toBe("/job/help-desk-coordinator-reqaaa1111111111");
    expect(jobLinkPath({})).toBe("");
    expect(jobPathFromHref("")).toBe("");
    expect(jobPathFromHref("/classic")).toBe("");
    expect(jobPathFromHref("http://")).toBe("");
    expect(jobCardSelector(job)).toBe(
      `[data-testid="job-results"] .hc-card-grid > div:has(a[href$="/job/help-desk-coordinator-${cssEscape(job.id)}"])`,
    );
    expect(jobCardSelector({ id: "reqaaa1111111111" })).toBe("");
    expect(
      jobCardSelector({
        id: "reqaaa1111111111",
        path: "/job/help-desk-coordinator-reqaaa1111111111",
      }),
    ).toBe("");
    expect(
      jobCardSelector({
        id: "reqaaa1111111111",
        path: "/job/help-desk-coordinator-reqaaa1111111111",
        cardHref: "https://hiringcafe.com/job/help-desk-coord-i-reqaaa1111111111",
      }),
    ).toContain('href$="/job/help-desk-coord-i-reqaaa1111111111"');
  });

  test("uses CSS.escape when it is available", () => {
    const original = globalThis.CSS;
    globalThis.CSS = { escape: (value) => `esc(${value})` };
    try {
      expect(cssEscape("req-1")).toBe("esc(req-1)");
    } finally {
      globalThis.CSS = original;
    }
  });

  test("falls back when CSS.escape is missing", () => {
    const original = globalThis.CSS;
    globalThis.CSS = undefined;
    try {
      expect(cssEscape("reqaaa1111111111")).toBe("reqaaa1111111111");
      expect(cssEscape("\0")).toBe("\uFFFD");
      expect(cssEscape("2id")).toMatch(/^\\32 /);
      expect(cssEscape("-2id")).toMatch(/^-\\32 /);
      expect(cssEscape("a b")).toContain("\\ ");
    } finally {
      globalThis.CSS = original;
    }
  });
});
