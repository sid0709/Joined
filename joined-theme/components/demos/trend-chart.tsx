"use client";

import { TrendChart } from "sid-ui";

import { Examples, Preview } from "./shared";

const WEEKS = [
  "Jul 14",
  "Jul 21",
  "Jul 28",
  "Aug 4",
  "Aug 11",
  "Aug 18",
  "Aug 25",
  "Sep 1",
  "Sep 8",
  "Sep 15",
  "Sep 22",
  "Sep 29",
];
const APPLIED = [4, 6, 5, 9, 7, 11, 8, 12, 10, 14, 9, 13];
const REPLIES = [1, 1, 2, 2, 3, 2, 4, 3, 5, 4, 4, 6];
const INTERVIEWS = [0, 0, 1, 0, 1, 1, 1, 2, 1, 2, 2, 3];

export default function TrendChartDemo() {
  return (
    <Examples>
      <Preview
        label="Area, several series"
        description="Up to four series on one axis, toned blue, orange, purple, green in that order. Hover or use the arrow keys to read every series at a week."
      >
        <TrendChart
          label="Applications, replies, and interviews per week"
          labels={WEEKS}
          series={[
            { label: "Applied", values: APPLIED },
            { label: "Replies", values: REPLIES },
            { label: "Interviews", values: INTERVIEWS },
          ]}
        />
      </Preview>
      <Preview
        label="Line, one series"
        description="One series needs no legend; the card title names it."
      >
        <TrendChart
          label="Applications per week"
          labels={WEEKS}
          series={[{ label: "Applied", values: APPLIED }]}
          variant="line"
          height={180}
        />
      </Preview>
    </Examples>
  );
}
