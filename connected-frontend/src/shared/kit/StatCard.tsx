import { Glyph, type GlyphName } from "@joined/design-system";

import type { ReactNode } from "react";

import { Sparkline } from "@/src/shared/kit/charts/Sparkline";

export type Tone = "accent" | "success" | "warning" | "danger";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: GlyphName;
  tone?: Tone;
  /** Short comparison such as "+12% vs last week". */
  delta?: { text: string; tone: "success" | "danger" | "warning" };
  footnote?: string;
  trend?: number[];
}

export function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  delta,
  footnote,
  trend,
}: StatCardProps) {
  return (
    <div className="hx-stat">
      <div className="hx-stat-top">
        <span className="hx-stat-label">{label}</span>
        <span className="hx-stat-icon" data-tone={tone}>
          <Glyph name={icon} size="1.1em" />
        </span>
      </div>
      <div className="hx-row hx-row-between" style={{ flexWrap: "nowrap" }}>
        <span className="hx-stat-value">{value}</span>
        {trend && trend.length > 1 && <Sparkline values={trend} />}
      </div>
      {(delta || footnote) && (
        <div className="hx-stat-foot">
          {delta && (
            <span className="hx-delta" data-tone={delta.tone}>
              {delta.text}
            </span>
          )}
          {footnote && <span>{footnote}</span>}
        </div>
      )}
    </div>
  );
}
