"use client";

import { ProgressBar, type ProgressBarVariant } from "@joined/design-system";

/**
 * A progress bar with a text value, usable from Server Components: the value
 * label is a string here, not the function ProgressBar takes.
 */
export function GoalBar({
  label,
  progress,
  valueLabel,
  variant = "accent",
}: {
  label: string;
  progress: number;
  valueLabel: string;
  variant?: ProgressBarVariant;
}) {
  return (
    <ProgressBar
      label={label}
      value={progress}
      hasValueLabel
      formatValueLabel={() => valueLabel}
      variant={variant}
    />
  );
}
