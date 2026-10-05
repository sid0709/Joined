"use client";

import { HeatmapCalendar, type HeatmapDay } from "@joined/design-system";

import { Examples, Preview } from "./shared";

const DAYS_SHOWN = 126;
const DAY_MS = 86_400_000;
const START = new Date(2026, 5, 1).getTime();

/** A steady, made-up rhythm: busy early in the week, quiet at weekends. */
const DAYS: HeatmapDay[] = Array.from({ length: DAYS_SHOWN }, (_, index) => {
  const date = new Date(START + index * DAY_MS);
  const weekday = date.getDay();
  const value = weekday === 0 || weekday === 6 ? (index % 5 === 0 ? 1 : 0) : (index * 7) % 6;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { date: iso, value };
});

export default function HeatmapCalendarDemo() {
  return (
    <Examples>
      <Preview
        label="Daily activity"
        description="Weeks run left to right, Sunday on top. Four blue steps from light to dark; hover or focus a day for its count."
      >
        <HeatmapCalendar label="Applications per day" unit="applications" days={DAYS} />
      </Preview>
    </Examples>
  );
}
