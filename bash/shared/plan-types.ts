/** Cross-package contracts for AI Analyze plans and deterministic plan-step execution. */
export type {
  ActionPlan,
  PauseDecision,
  PauseRequest,
  PlanAction,
  PlanActionType,
  PlanStepActionType,
  PlanStepPayload,
  PlanStepResult,
  RuntimeAttachedFile,
  RunReport,
  RunStepRecord,
  RunStepStatus,
} from "./plan-runner/types";

export interface PlanStepRequest {
  tabId: number;
  url: string;
  extensionId?: string;
  step: import("./plan-runner/types").PlanStepPayload;
}
