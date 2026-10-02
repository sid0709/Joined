import { describe, expect, test } from "bun:test";

import {
  type GoogleEvent,
  browserTimeZone,
  googleEventsOn,
  monthWindow,
  toGoogleCalendarEvents,
} from "./google-calendar";

const standup: GoogleEvent = {
  id: "a",
  title: "Standup",
  date: "2026-10-05",
  start: "09:00",
  end: "09:15",
  allDay: false,
  location: "Zoom",
};

const trip: GoogleEvent = {
  id: "b",
  title: "Trip",
  date: "2026-10-30",
  endDate: "2026-11-02",
  allDay: true,
};

describe("monthWindow", () => {
  test("covers the month and a week either side", () => {
    expect(monthWindow(new Date(2026, 9, 17))).toEqual({ from: "2026-09-24", to: "2026-11-07" });
  });

  test("crosses the year", () => {
    expect(monthWindow(new Date(2026, 11, 3))).toEqual({ from: "2026-11-24", to: "2027-01-07" });
  });
});

describe("toGoogleCalendarEvents", () => {
  test("shows timed events once, as neutral chips with their times", () => {
    const [chip] = toGoogleCalendarEvents([standup]);
    expect(chip).toMatchObject({
      id: "google:a:2026-10-05",
      title: "Standup",
      start: "09:00",
      end: "09:15",
      tone: "neutral",
      location: "Zoom",
    });
    expect(chip?.date).toEqual(new Date(2026, 9, 5));
  });

  test("shows an all-day span on every day it covers, without times", () => {
    const chips = toGoogleCalendarEvents([trip]);
    expect(chips.map((chip) => chip.id)).toEqual([
      "google:b:2026-10-30",
      "google:b:2026-10-31",
      "google:b:2026-11-01",
      "google:b:2026-11-02",
    ]);
    expect(chips.every((chip) => chip.start === undefined)).toBe(true);
  });
});

describe("googleEventsOn", () => {
  test("finds timed events on their day and all-day spans on every day", () => {
    expect(googleEventsOn([standup, trip], new Date(2026, 9, 5))).toEqual([standup]);
    expect(googleEventsOn([standup, trip], new Date(2026, 10, 1))).toEqual([trip]);
    expect(googleEventsOn([standup, trip], new Date(2026, 10, 3))).toEqual([]);
  });
});

test("browserTimeZone names an IANA zone", () => {
  expect(browserTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$|^UTC$/);
});
