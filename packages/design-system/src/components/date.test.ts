import { describe, expect, it } from "bun:test";

import {
  addDays,
  addMonths,
  daysInMonth,
  isBetween,
  monthGrid,
  monthNames,
  sameDay,
  sameMonth,
  startOfDay,
  startOfWeek,
  toISODate,
  weekOf,
  weekdayNames,
} from "./date";

describe("date helpers", () => {
  it("normalizes and adds local calendar days", () => {
    const date = new Date(2024, 0, 31, 18, 45);

    expect(startOfDay(date)).toEqual(new Date(2024, 0, 31));
    expect(addDays(date, 1)).toEqual(new Date(2024, 1, 1));
  });

  it("clamps month changes and handles leap years", () => {
    expect(addMonths(new Date(2024, 0, 31), 1)).toEqual(new Date(2024, 1, 29));
    expect(addMonths(new Date(2024, 2, 31), -1)).toEqual(new Date(2024, 1, 29));
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
  });

  it("compares days and months without comparing time", () => {
    expect(sameDay(new Date(2024, 3, 8, 8), new Date(2024, 3, 8, 21))).toBe(true);
    expect(sameDay(null, new Date(2024, 3, 8))).toBe(false);
    expect(sameDay(new Date(2024, 3, 8), undefined)).toBe(false);
    expect(sameMonth(new Date(2024, 3, 1), new Date(2024, 3, 30))).toBe(true);
    expect(sameMonth(new Date(2024, 3, 1), new Date(2024, 4, 1))).toBe(false);
  });

  it("builds weeks and fixed six-week month grids", () => {
    const date = new Date(2024, 4, 8);
    const sundayStart = startOfWeek(date, 0);
    const mondayStart = startOfWeek(date, 1);

    expect(sundayStart.getDay()).toBe(0);
    expect(mondayStart.getDay()).toBe(1);
    expect(weekOf(date, 1)).toHaveLength(7);
    expect(weekOf(date, 1)[0]).toEqual(mondayStart);
    expect(monthGrid(date, 0)).toHaveLength(42);
    expect(monthGrid(date, 1)).toHaveLength(42);
  });

  it("checks exclusive ranges in either endpoint order", () => {
    const start = new Date(2024, 0, 10, 23);
    const middle = new Date(2024, 0, 11, 12);
    const end = new Date(2024, 0, 12, 1);

    expect(isBetween(middle, start, end)).toBe(true);
    expect(isBetween(middle, end, start)).toBe(true);
    expect(isBetween(start, start, end)).toBe(false);
  });

  it("formats localized weekday and month labels and local ISO dates", () => {
    expect(weekdayNames(0, "short")).toHaveLength(7);
    expect(weekdayNames(1, "narrow", "en-US")).toHaveLength(7);
    expect(monthNames("short")).toHaveLength(12);
    expect(monthNames("long", "en-US")).toHaveLength(12);
    expect(toISODate(new Date(2026, 8, 5))).toBe("2026-09-05");
  });
});
