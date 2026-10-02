/** One-click fill pipeline progress contract (extension ↔ Chrome side panel). */

import type { AiUsageSummary } from "./ai-usage";
import type { ActionPlan, RunStepRecord } from "./plan-runner/types";
import type { DomTreeNode } from "./tree-export";

export type PipelinePhase = "idle" | "fetching" | "analyzing" | "running" | "done" | "error";

export interface PipelineTreeSnapshot {
  url: string;
  title: string;
  tree: DomTreeNode;
  fetchedAt: string;
}

export interface PipelineProgress {
  phase: PipelinePhase;
  message: string;
  stepIndex?: number;
  stepTotal?: number;
  stepLabel?: string;
  error?: string;
  /** Wall-clock ms for the full FAB pipeline (set on done/error). */
  durationMs?: number;
  /** Aggregated AI token usage / estimated USD (analyze + match-option). */
  usage?: AiUsageSummary | null;
  /** UI-only snapshot of the tree sent to AI Analyze. */
  tree?: PipelineTreeSnapshot;
  /** UI-only AI Analyze plan JSON. */
  plan?: ActionPlan;
  /** UI-only live plan-run records (ok / skipped / blocked / failed). */
  steps?: RunStepRecord[];
  /** Library resume used (or skipped) for this tab's Fill run. */
  resumeUpload?: {
    status: "ready" | "uploaded" | "skipped";
    stack: string | null;
    fileName: string | null;
    resumeId?: string | null;
    reason?: string | null;
  };
}

export const IDLE_PIPELINE_PROGRESS: PipelineProgress = {
  phase: "idle",
  message: "Idle",
};

export function isFillPhaseBusy(phase: PipelinePhase): boolean {
  return phase === "fetching" || phase === "analyzing" || phase === "running";
}

export function mergePipelineProgress(
  prev: PipelineProgress,
  next: PipelineProgress,
): PipelineProgress {
  const starting = next.phase === "fetching";
  return {
    ...prev,
    ...next,
    tree: starting ? next.tree : (next.tree ?? prev.tree),
    plan: starting ? next.plan : (next.plan ?? prev.plan),
    steps: starting ? (next.steps ?? []) : (next.steps ?? prev.steps),
    resumeUpload: starting ? next.resumeUpload : (next.resumeUpload ?? prev.resumeUpload),
  };
}
