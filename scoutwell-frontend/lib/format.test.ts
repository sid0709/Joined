import { describe, expect, it } from "bun:test";

import { formatCount, progressTo, sourceLabel } from "./format";

describe("format", () => {
  it("picks singular or plural labels", () => {
    expect(formatCount(1, "job")).toBe("1 job");
    expect(formatCount(3, "job")).toBe("3 jobs");
  });

  it("clamps progress toward a goal", () => {
    expect(progressTo(15, 30)).toBe(50);
    expect(progressTo(45, 30)).toBe(100);
    expect(progressTo(3, 0)).toBe(100);
  });

  it("names the ATS when known", () => {
    expect(sourceLabel("jobs.lever.co", "Lever")).toBe("Lever · jobs.lever.co");
    expect(sourceLabel("acme.com")).toBe("acme.com");
  });
});
