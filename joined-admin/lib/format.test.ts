import { describe, expect, test } from "bun:test";

import {
  ageLabel,
  formatCount,
  formatDate,
  formatDateTime,
  jobLocation,
  positiveInt,
} from "./format";

describe("dates", () => {
  test("formats or dashes", () => {
    expect(formatDate("2026-09-28T12:00:00Z")).toContain("2026");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("nope")).toBe("—");
    expect(formatDateTime("2026-09-28T12:00:00Z")).toContain("Sep");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("nope")).toBe("—");
  });

  test("ages read in the largest whole unit", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(ageLabel("2026-09-28T11:55:00Z", now)).toBe("5m");
    expect(ageLabel("2026-09-28T09:00:00Z", now)).toBe("3h");
    expect(ageLabel("2026-09-26T12:00:00Z", now)).toBe("2d");
    expect(ageLabel(null, now)).toBe("—");
    expect(ageLabel("nope", now)).toBe("—");
  });
});

test("counts use grouping", () => {
  expect(formatCount(12345)).toBe("12,345");
});

test("job location joins place and workplace", () => {
  expect(
    jobLocation({ _id: "1", metadata: { details: { location: "Berlin", remote: "Hybrid" } } }),
  ).toBe("Berlin · Hybrid");
  expect(jobLocation({ _id: "2" })).toBe("");
});

test("positiveInt falls back on junk", () => {
  expect(positiveInt("3", 1)).toBe(3);
  expect(positiveInt("0", 1)).toBe(1);
  expect(positiveInt(null, 2)).toBe(2);
});
