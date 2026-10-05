"use client";

import { useState } from "react";

import { conversionRates } from "./chartMath";
import { ChartTable, defaultFormat, type ChartTone } from "./chartParts";

export type FunnelStage = {
  label: string;
  value: number;
  /** A quiet note under the name, e.g. "Recruiter or hiring manager wrote back". */
  hint?: string;
};

/**
 * Stages that narrow: saved → applied → replied → interview → offer. Each bar is drawn
 * against the first stage; the badge after it is the conversion from the stage above.
 */
export function FunnelChart({
  stages,
  label,
  tone = "blue",
  formatValue = defaultFormat,
}: {
  stages: FunnelStage[];
  /** Accessible name for the chart. */
  label: string;
  tone?: ChartTone;
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const first = Math.max(0, stages[0]?.value ?? 0);
  const rates = conversionRates(stages.map((stage) => stage.value));

  return (
    <div className="os-chart">
      <ol className="os-funnel" aria-label={label}>
        {stages.map((stage, index) => (
          <li
            key={stage.label}
            className="os-funnel-stage"
            data-active={active === index || undefined}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="os-funnel-head">
              <span className="os-funnel-name">{stage.label}</span>
              {stage.hint ? <span className="os-funnel-hint">{stage.hint}</span> : null}
            </span>
            <span className="os-funnel-track">
              <span
                className="os-funnel-mark"
                data-tone={tone}
                style={{ width: first > 0 ? `${(Math.max(0, stage.value) / first) * 100}%` : "0%" }}
              />
            </span>
            <span className="os-funnel-figures">
              <strong>{formatValue(stage.value)}</strong>
              {index > 0 ? (
                <span className="os-funnel-rate" title={`From ${stages[index - 1].label}`}>
                  {rates[index]}%
                </span>
              ) : (
                <span className="os-funnel-rate" data-first>
                  100%
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <ChartTable
        caption={label}
        headers={["Stage", "Count", "From the stage above"]}
        rows={stages.map((stage, index) => [
          stage.label,
          formatValue(stage.value),
          index === 0 ? "—" : `${rates[index]}%`,
        ])}
      />
    </div>
  );
}
