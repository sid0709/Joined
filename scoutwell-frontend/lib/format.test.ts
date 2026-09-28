import { describe, expect, it } from "bun:test";

import { clampPercent, formatCount, parseTags, percent } from "./format";

describe("format", () => {
  it("picks singular or plural labels", () => {
    expect(formatCount(1, "job")).toBe("1 job");
    expect(formatCount(3, "job")).toBe("3 jobs");
  });

  it("computes percents safely", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(1, 0)).toBe(0);
    expect(clampPercent(140)).toBe(100);
  });

  it("dedupes comma-separated tags", () => {
    expect(parseTags(" Remote, visa, remote ")).toEqual(["remote", "visa"]);
  });
});
