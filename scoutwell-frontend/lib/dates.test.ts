import { describe, expect, it } from "bun:test";

import {
  addDays,
  daysBetween,
  formatDateTime,
  formatDay,
  greeting,
  relativeDay,
  startOfDay,
} from "./dates";

describe("dates", () => {
  it("counts whole local days between two dates", () => {
    const from = startOfDay(new Date("2026-09-01T15:00:00"));
    const to = startOfDay(new Date("2026-09-04T08:00:00"));
    expect(daysBetween(from, to)).toBe(3);
  });

  it("describes relative days", () => {
    const now = new Date("2026-09-28T12:00:00");
    expect(relativeDay(now.toISOString(), now)).toBe("Today");
    expect(relativeDay("2026-09-27T12:00:00", now)).toBe("Yesterday");
    expect(relativeDay("2026-09-29T12:00:00", now)).toBe("Tomorrow");
    expect(relativeDay("2026-09-30T12:00:00", now)).toBe("In 2 days");
    expect(relativeDay("2026-09-20T12:00:00", now)).toBe("8 days ago");
  });

  it("shifts an ISO timestamp by days", () => {
    expect(addDays("2026-09-01T00:00:00.000Z", 14)).toBe("2026-09-15T00:00:00.000Z");
  });

  it("shows the year only when it differs", () => {
    const now = new Date("2026-09-28T12:00:00");
    expect(formatDay("2026-09-02T12:00:00", now)).toBe("Sep 2");
    expect(formatDay("2025-09-02T12:00:00", now)).toBe("Sep 2, 2025");
  });

  it("formats a date with its time", () => {
    expect(formatDateTime("2026-09-02T15:04:00")).toContain("Sep 2");
  });

  it("greets by time of day", () => {
    expect(greeting(new Date("2026-09-28T09:00:00"))).toBe("Good morning");
    expect(greeting(new Date("2026-09-28T14:00:00"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-09-28T20:00:00"))).toBe("Good evening");
  });
});
