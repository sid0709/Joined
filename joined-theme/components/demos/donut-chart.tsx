"use client";

import { DonutChart } from "@joined/design-system";

import { Examples, Preview } from "./shared";

export default function DonutChartDemo() {
  return (
    <Examples>
      <Preview
        label="Status mix"
        description="Up to five slices with a 2px surface gap. Hover a slice or legend row and the middle shows it."
      >
        <DonutChart
          label="Applications by status"
          centerLabel="Applications"
          data={[
            { label: "Waiting", value: 38 },
            { label: "Replied", value: 12 },
            { label: "Interview", value: 6 },
            { label: "Offer", value: 2 },
            { label: "Closed", value: 9, tone: "neutral" },
          ]}
        />
      </Preview>
      <Preview
        label="Smaller"
        description="size shrinks the ring; the legend wraps below on narrow cards."
      >
        <DonutChart
          label="Replies by kind"
          centerLabel="Replies"
          size={128}
          data={[
            { label: "Interview", value: 6 },
            { label: "Next step", value: 4 },
            { label: "Rejection", value: 7, tone: "red" },
          ]}
        />
      </Preview>
    </Examples>
  );
}
