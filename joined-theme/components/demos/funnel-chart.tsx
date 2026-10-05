"use client";

import { FunnelChart } from "@joined/design-system";

import { Examples, Preview } from "./shared";

export default function FunnelChartDemo() {
  return (
    <Examples>
      <Preview
        label="Pipeline"
        description="Each bar is drawn against the first stage; the percentage is conversion from the stage above."
      >
        <FunnelChart
          label="Application pipeline"
          stages={[
            { label: "Saved", value: 96, hint: "Jobs kept for later" },
            { label: "Applied", value: 64, hint: "Submitted by Acorn" },
            { label: "Replied", value: 18, hint: "A person wrote back" },
            { label: "Interview", value: 7 },
            { label: "Offer", value: 2 },
          ]}
        />
      </Preview>
    </Examples>
  );
}
