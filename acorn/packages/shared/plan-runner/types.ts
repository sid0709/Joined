/** Plan and run contracts for the extension's fill pipeline. */

export type PlanActionType =
  | "fill"
  | "upload"
  | "resume_upload"
  | "select_radio"
  | "wait"
  | "validate"
  | "pause_for_review"
  | "forbidden";

export type PlanStepActionType =
  "fill" | "upload" | "resume_upload" | "select_radio" | "wait" | "validate" | "verify_only";

export interface PlanAction {
  action: PlanActionType;
  element_index: number | null;
  element_indexes: number[] | null;
  expected_label: string | null;
  expected_role: string | null;
  value: string | null;
  file: string | null;
  reason: string | null;
  ms: number | null;
}

export interface ActionPlan {
  goal: string;
  actions: PlanAction[];
  forbidden_actions: PlanAction[];
  validation: {
    required_element_indexes: number[];
    stop_before_submit: boolean;
  };
  unresolved_items: string[];
}

export interface RuntimeAttachedFile {
  key: string;
  name: string;
  mimeType: string;
  base64: string;
  /** Library stack label for UI (e.g. folder title). */
  label?: string | null;
  /** Library row id assigned to this job. */
  resumeId?: string | null;
  /** Worker pool job this file was fetched for. */
  jobId?: string | null;
}

export interface PlanStepPayload {
  action: PlanStepActionType;
  element_index: number | null;
  element_indexes: number[] | null;
  expected_label: string | null;
  expected_role: string | null;
  value: string | null;
  file?: RuntimeAttachedFile | null;
  ms: number | null;
}

export interface PlanStepResult {
  ok: boolean;
  verified?: boolean;
  acted?: boolean;
  /** True when the control already had the intended value. */
  alreadyFilled?: boolean;
  error?: string;
  details?: {
    nodeId?: number;
    matchedLabel?: string;
    matchedRole?: string;
    valueAfter?: string;
  };
}

export type PauseDecision = "continue" | "skip" | "abort";

export type RunStepStatus =
  "pending" | "running" | "ok" | "paused" | "skipped" | "blocked" | "failed" | "aborted";

export interface RunStepRecord {
  index: number;
  action: string;
  element_index: number | null;
  expected_label: string | null;
  status: RunStepStatus;
  message?: string;
}

export interface PauseRequest {
  index: number;
  action: string;
  element_index: number | null;
  expected_label: string | null;
  reason: string;
  kind: "planned" | "error";
}

export interface RunReport {
  ok: boolean;
  aborted: boolean;
  steps: RunStepRecord[];
  summary: {
    ok: number;
    skipped: number;
    blocked: number;
    failed: number;
    paused: number;
  };
}
