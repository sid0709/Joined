import { expect, test } from "bun:test";

import { parseDay, parseJSONDate, toDayString } from "./dates";

test("parseJSONDate keeps dates, parses strings, and falls back to now", () => {
  const at = new Date(2026, 9, 5, 14, 30);
  expect(parseJSONDate(at)).toBe(at);
  expect(parseJSONDate("2026-10-05T14:30:00.000Z").toISOString()).toBe("2026-10-05T14:30:00.000Z");
  const before = Date.now();
  expect(parseJSONDate(undefined).getTime()).toBeGreaterThanOrEqual(before);
  expect(parseJSONDate("garbage").getTime()).toBeGreaterThanOrEqual(before);
});

test("parseDay reads a day at local midnight", () => {
  expect(parseDay("2026-10-05")).toEqual(new Date(2026, 9, 5));
  expect(parseDay(new Date(2026, 9, 5, 23, 59))).toEqual(new Date(2026, 9, 5));
  expect(parseDay("2026-10-05T14:30:00")).toEqual(new Date(2026, 9, 5));
  expect(parseDay(undefined).getHours()).toBe(0);
});

test("toDayString pads month and day", () => {
  expect(toDayString(new Date(2026, 0, 9))).toBe("2026-01-09");
});
