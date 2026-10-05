"use client";

import { Grid, KpiWidget, Sparkline } from "sid-ui";

import { Examples, Preview } from "./shared";

const KPI_MIN_WIDTH = 200;

export default function SparklineDemo() {
  return (
    <Examples>
      <Preview
        label="Under a KPI"
        description="No axes — the number above carries the value; the line shows the direction."
      >
        <Grid columns={{ minWidth: KPI_MIN_WIDTH }} gap={4}>
          <KpiWidget
            label="Applications"
            value="64"
            delta={{ value: "+18%", direction: "up" }}
            hint="Last 12 weeks"
          >
            <Sparkline
              label="Applications per week"
              values={[4, 6, 5, 9, 7, 11, 8, 12, 10, 14, 9, 13]}
            />
          </KpiWidget>
          <KpiWidget
            label="Response rate"
            value="28%"
            delta={{ value: "+4 pts", direction: "up" }}
            hint="Replies over applications"
          >
            <Sparkline
              label="Response rate per week"
              tone="green"
              values={[20, 18, 22, 21, 25, 24, 27, 26, 28]}
            />
          </KpiWidget>
          <KpiWidget
            label="Days to reply"
            value="4.2"
            delta={{ value: "−0.6", direction: "up" }}
            hint="Median, first reply"
          >
            <Sparkline
              label="Median days to reply per week"
              tone="orange"
              values={[6, 5.5, 5.8, 5, 4.9, 4.6, 4.2]}
            />
          </KpiWidget>
        </Grid>
      </Preview>
    </Examples>
  );
}
