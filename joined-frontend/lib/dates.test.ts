import { describe, expect, test } from "bun:test";

import {
  daysBetween,
  daysFromToday,
  formatAgo,
  formatClock,
  formatDay,
  formatISODate,
  formatLongDate,
  formatMonthDay,
  formatShortDate,
  formatTime,
  isSameDay,
  parseISODate,
  relativeDay,
  startOfDay,
} from "./dates";

const monday = new Date(2026, 9, 5, 14, 30);

describe("days", () => {
  test("startOfDay drops the time", () => {
    expect(startOfDay(monday)).toEqual(new Date(2026, 9, 5));
  });

  test("daysFromToday counts from local midnight", () => {
    expect(daysBetween(new Date(), daysFromToday(3))).toBe(3);
    expect(daysFromToday(0)).toEqual(startOfDay(new Date()));
  });

  test("isSameDay and daysBetween ignore the time of day", () => {
    expect(isSameDay(monday, new Date(2026, 9, 5, 23, 59))).toBe(true);
    expect(isSameDay(monday, new Date(2026, 9, 6))).toBe(false);
    expect(daysBetween(monday, new Date(2026, 9, 8, 1))).toBe(3);
    expect(daysBetween(monday, new Date(2026, 9, 2))).toBe(-3);
  });

  test("relativeDay names nearby days", () => {
    const at = (offset: number) => new Date(2026, 9, 5 + offset);
    expect(relativeDay(at(0), monday)).toBe("Today");
    expect(relativeDay(at(1), monday)).toBe("Tomorrow");
    expect(relativeDay(at(-1), monday)).toBe("Yesterday");
    expect(relativeDay(at(4), monday)).toBe("In 4 days");
    expect(relativeDay(at(-5), monday)).toBe("5 days ago");
  });
});

describe("formatting", () => {
  test("formats days for people", () => {
    expect(formatDay(monday)).toBe("Mon, Oct 5");
    expect(formatShortDate(monday)).toBe("Oct 5");
    expect(formatLongDate(monday)).toBe("October 5, 2026");
    expect(formatMonthDay(monday)).toEqual({ month: "OCT", day: "5", weekday: "Mon" });
  });

  test("ISO days round-trip at local midnight", () => {
    expect(parseISODate("2026-10-05")).toEqual(new Date(2026, 9, 5));
    expect(formatISODate(monday)).toBe("2026-10-05");
    expect(formatISODate(parseISODate("2026-01-09"))).toBe("2026-01-09");
    expect(Number.isNaN(parseISODate("not a date").getTime())).toBe(true);
  });

  test("formats clock times", () => {
    expect(formatTime("14:30")).toMatch(/^2:30\sPM$/);
    expect(formatTime("09:05")).toMatch(/^9:05\sAM$/);
    expect(formatClock(monday)).toMatch(/^2:30\sPM$/);
  });

  test("formatAgo shortens recent activity", () => {
    const ago = (minutes: number) => new Date(monday.getTime() - minutes * 60_000);
    expect(formatAgo(ago(0), monday)).toBe("Just now");
    expect(formatAgo(ago(12), monday)).toBe("12 min ago");
    expect(formatAgo(ago(60), monday)).toBe("1 hour ago");
    expect(formatAgo(ago(180), monday)).toBe("3 hours ago");
    expect(formatAgo(ago(60 * 24 * 2), monday)).toBe("2 days ago");
  });
});
