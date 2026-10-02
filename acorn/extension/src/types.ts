export interface DomNode {
  nodeId: number;
  tag: string;
  id?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  text?: string;
  childCount: number;
  children: DomNode[];
}

export interface DomTreePayload {
  url: string;
  title: string;
  tree: DomNode;
  fetchedAt: string;
  tabId?: number;
  frameId?: number;
  /** Fillable control count used to pick the form frame among iframes. */
  formScore?: number;
}

/** Long-lived side-panel port. Keeps the MV3 worker (and `/acorn/socket.io` socket) alive. */
export const ACORN_SIDEBAR_PORT = "acorn-sidebar";

export const MSG = {
  FETCH_DOM: "acorn:fetch-dom",
  FETCH_AND_EMIT_DOM: "acorn:fetch-and-emit-dom",
  HIGHLIGHT: "acorn:highlight",
  CLEAR_HIGHLIGHT: "acorn:clear-highlight",
  GET_CONTENT: "acorn:get-content",
  EXECUTE_ACTIONS: "acorn:execute-actions",
  PLAN_STEP: "acorn:plan-step",
  MATCH_OPTION: "acorn:match-option",
  FILL_LEFTOVER_COMBOS: "acorn:fill-leftover-combos",
  START_PIPELINE: "acorn:start-pipeline",
  PIPELINE_PROGRESS: "acorn:pipeline-progress",
  SOCKET_STATUS: "acorn:socket-status",
  OPERATOR_NOTICE: "acorn:operator-notice",
  AUTH_STATUS: "acorn:auth-status",
  AUTH_SIGNIN: "acorn:auth-signin",
  AUTH_SIGNOUT: "acorn:auth-signout",
  LIST_WORKER_JOBS: "acorn:list-worker-jobs",
  OPEN_WORKER_JOB: "acorn:open-worker-job",
  MARK_JOB_APPLIED: "acorn:mark-job-applied",
  GET_TAB_JOB: "acorn:get-tab-job",
  REMEMBER_CUSTOM_TAB: "acorn:remember-custom-tab",
  FORGET_CUSTOM_TAB: "acorn:forget-custom-tab",
  FOCUS_CUSTOM_TAB: "acorn:focus-custom-tab",
  START_CUSTOM_GENERATE: "acorn:start-custom-generate",
  START_CUSTOM_RECOMMEND: "acorn:start-custom-recommend",
  START_JOB_GENERATE: "acorn:start-job-generate",
  START_JOB_RECOMMEND: "acorn:start-job-recommend",
  SELECTION_QA: "acorn:selection-qa",
} as const;

export type AcornNoticeKind = "error" | "success" | "info";

export type AcornNoticePayload = {
  kind: AcornNoticeKind;
  title: string;
  detail?: string;
};

export type PipelineSource = "fill" | "custom";

export interface MatchOptionRequest {
  intendedValue: string;
  options: string[];
  fieldLabel?: string | null;
  typedQuery?: string | null;
}

export interface MatchOptionResponse {
  ok?: boolean;
  matched_option?: string | null;
  confidence?: number;
  reason?: string;
  error?: string;
  model?: string;
  usage?: import("@acorn/shared/ai-usage").AiUsageSummary;
}

export type PlanStepActionType =
  "fill" | "upload" | "resume_upload" | "select_radio" | "wait" | "validate" | "verify_only";

export interface RuntimeAttachedFile {
  key: string;
  name: string;
  mimeType: string;
  base64: string;
  label?: string | null;
  resumeId?: string | null;
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

export interface PlanStepSocketPayload {
  tabId: number;
  url: string;
  extensionId?: string;
  frameId?: number | null;
  step: PlanStepPayload;
}

export interface PlanStepResult {
  ok: boolean;
  verified?: boolean;
  acted?: boolean;
  /** True when the control already had the intended value (do not confuse with frame `skipped`). */
  alreadyFilled?: boolean;
  error?: string;
  details?: {
    nodeId?: number;
    matchedLabel?: string;
    matchedRole?: string;
    valueAfter?: string;
  };
}

export interface HighlightPayload {
  nodeId: number;
  tabId: number;
  url: string;
}

export interface GetContentPayload {
  nodeId: number;
  tabId: number;
  contentType: "innerHTML" | "innerText";
}

export interface ActionStep {
  type: "focus" | "click" | "type" | "wait" | "keydown" | "keyup";
  text?: string;
  ms?: number;
  key?: string;
}

export interface ExecuteActionsPayload {
  nodeId: number;
  tabId: number;
  steps: ActionStep[];
}

export type SelectionQaResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
};
