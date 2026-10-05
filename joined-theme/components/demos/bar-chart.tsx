"use client";

import { BarChart } from "@joined/design-system";

import { Examples, Preview } from "./shared";

const WEEKDAYS = [
  { label: "Sun", value: 2 },
  { label: "Mon", value: 14 },
  { label: "Tue", value: 18 },
  { label: "Wed", value: 12 },
  { label: "Thu", value: 9 },
  { label: "Fri", value: 6 },
  { label: "Sat", value: 1 },
];

const SOURCES = [
  { label: "LinkedIn", value: 26 },
  { label: "Greenhouse", value: 17 },
  { label: "Lever", value: 11 },
  { label: "Company site", value: 7 },
  { label: "Workday", value: 3 },
];

export default function BarChartDemo() {
  return (
    <Examples>
      <Preview
        label="Columns"
        description="Columns cap at 24px with a rounded data end and the value on the cap. Hover or focus a column for its share."
      >
        <BarChart label="Applications by weekday" data={WEEKDAYS} />
      </Preview>
      <Preview label="Bars" description="Ranked bars for longer names: name, bar, value.">
        <BarChart label="Applications by source" orientation="bars" data={SOURCES} />
      </Preview>
      <Preview
        label="Call out one bar"
        description="One series takes one tone; give a single datum its own tone to point at it."
      >
        <BarChart
          label="Applications by weekday"
          tone="neutral"
          data={WEEKDAYS.map((day) =>
            day.label === "Tue" ? { ...day, tone: "blue" as const } : day,
          )}
        />
      </Preview>
    </Examples>
  );
}
