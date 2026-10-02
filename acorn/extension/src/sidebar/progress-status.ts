import { formatDuration, formatUsd } from "@acorn/shared/ai-usage";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";

export function formatProgressStatus(progress: PipelineProgress): string {
  if (progress.phase === "idle") return progress.message || "Ready";
  return [
    progress.message,
    progress.stepLabel ? `Step: ${progress.stepLabel}` : null,
    progress.durationMs != null ? `Time: ${formatDuration(progress.durationMs)}` : null,
    progress.usage
      ? `AI: ${formatUsd(progress.usage.costUsd)} · ${progress.usage.totalTokens || 0} tok`
      : null,
    progress.error ? `Error: ${progress.error}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
